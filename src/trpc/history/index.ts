import { z } from "zod/v4";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import { db } from "~/db";
import { queryHistory, type QueryHistory } from "~/db/schema";
import logger from "~/lib/logging";

/**
 * Default maximum number of history entries to keep per connection
 */
const DEFAULT_HISTORY_LIMIT = 100;

/**
 * Zod schemas for query history input validation
 */
const createHistoryEntrySchema = z.object({
	connectionId: z.number().int().positive(),
	queryText: z.string().min(1),
	executionTimeMs: z.number().int().min(0).optional(),
	rowCount: z.number().int().min(0).optional(),
	success: z.boolean().default(true),
	errorMessage: z.string().optional(),
});

const listHistorySchema = z.object({
	connectionId: z.number().int().positive().optional(),
	limit: z.number().int().min(1).max(500).default(50),
	offset: z.number().int().min(0).default(0),
	search: z.string().optional(),
	successOnly: z.boolean().optional(),
});

/**
 * Response type for query history entries
 */
export interface QueryHistoryEntry {
	id: number;
	connectionId: number;
	queryText: string;
	executionTimeMs: number | null;
	rowCount: number | null;
	success: boolean;
	errorMessage: string | null;
	executedAt: string;
}

/**
 * Converts a database query history record to the API response type
 */
function toQueryHistoryEntry(entry: QueryHistory): QueryHistoryEntry {
	return {
		id: entry.id,
		connectionId: entry.connectionId,
		queryText: entry.queryText,
		executionTimeMs: entry.executionTimeMs,
		rowCount: entry.rowCount,
		success: entry.success,
		errorMessage: entry.errorMessage,
		executedAt: entry.executedAt,
	};
}

/**
 * Trims history entries for a connection to keep only the most recent N entries
 */
async function trimHistory(connectionId: number, limit: number = DEFAULT_HISTORY_LIMIT): Promise<void> {
	// Get the IDs of entries to keep (most recent N)
	const entriesToKeep = db
		.select({ id: queryHistory.id })
		.from(queryHistory)
		.where(eq(queryHistory.connectionId, connectionId))
		.orderBy(desc(queryHistory.executedAt))
		.limit(limit)
		.all();

	const keepIds = entriesToKeep.map((e) => e.id);

	if (keepIds.length === 0) return;

	// Delete entries not in the keep list
	// Use raw SQL for the NOT IN clause since Drizzle's API is limited
	db.run(
		sql`DELETE FROM query_history
			WHERE connection_id = ${connectionId}
			AND id NOT IN (${sql.join(keepIds.map((id) => sql`${id}`), sql`, `)})`
	);
}

export const historyRouter = router({
	/**
	 * Add a new query history entry
	 * Automatically trims old entries to maintain the configured limit
	 */
	create: publicProcedure.input(createHistoryEntrySchema).mutation(async ({ input }) => {
		logger.debug(`[History] Recording query for connection ${input.connectionId}`);

		const result = db
			.insert(queryHistory)
			.values({
				connectionId: input.connectionId,
				queryText: input.queryText,
				executionTimeMs: input.executionTimeMs,
				rowCount: input.rowCount,
				success: input.success,
				errorMessage: input.errorMessage,
			})
			.returning()
			.get();

		// Trim old entries in the background
		trimHistory(input.connectionId).catch((error) => {
			logger.error(`[History] Failed to trim history for connection ${input.connectionId}`, error);
		});

		logger.debug(`[History] Recorded query ${result.id} for connection ${input.connectionId}`);
		return toQueryHistoryEntry(result);
	}),

	/**
	 * List query history entries with optional filtering
	 */
	list: publicProcedure.input(listHistorySchema).query(async ({ input }) => {
		const { connectionId, limit, offset, search, successOnly } = input;

		// Build conditions
		const conditions = [];

		if (connectionId !== undefined) {
			conditions.push(eq(queryHistory.connectionId, connectionId));
		}

		if (successOnly !== undefined) {
			conditions.push(eq(queryHistory.success, successOnly));
		}

		if (search && search.trim()) {
			conditions.push(like(queryHistory.queryText, `%${search.trim()}%`));
		}

		// Execute query
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const entries = db
			.select()
			.from(queryHistory)
			.where(whereClause)
			.orderBy(desc(queryHistory.executedAt))
			.limit(limit)
			.offset(offset)
			.all();

		// Get total count for pagination
		const countResult = db
			.select({ count: sql<number>`count(*)` })
			.from(queryHistory)
			.where(whereClause)
			.get();

		const total = countResult?.count ?? 0;

		return {
			entries: entries.map(toQueryHistoryEntry),
			total,
			hasMore: offset + entries.length < total,
		};
	}),

	/**
	 * Get a single query history entry by ID
	 */
	get: publicProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.query(async ({ input }) => {
			const entry = db
				.select()
				.from(queryHistory)
				.where(eq(queryHistory.id, input.id))
				.get();

			if (!entry) {
				throw new Error(`Query history entry with ID ${input.id} not found`);
			}

			return toQueryHistoryEntry(entry);
		}),

	/**
	 * Delete a single query history entry
	 */
	delete: publicProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			logger.info(`[History] Deleting query history entry ${input.id}`);

			const existing = db
				.select()
				.from(queryHistory)
				.where(eq(queryHistory.id, input.id))
				.get();

			if (!existing) {
				throw new Error(`Query history entry with ID ${input.id} not found`);
			}

			db.delete(queryHistory).where(eq(queryHistory.id, input.id)).run();

			return { success: true, deletedId: input.id };
		}),

	/**
	 * Clear all history for a specific connection
	 */
	clearByConnection: publicProcedure
		.input(z.object({ connectionId: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			logger.info(`[History] Clearing history for connection ${input.connectionId}`);

			const result = db
				.delete(queryHistory)
				.where(eq(queryHistory.connectionId, input.connectionId))
				.run();

			const deletedCount = result.changes;
			logger.info(`[History] Cleared ${deletedCount} entries for connection ${input.connectionId}`);

			return { success: true, deletedCount };
		}),

	/**
	 * Clear all query history
	 */
	clearAll: publicProcedure.mutation(async () => {
		logger.info("[History] Clearing all query history");

		const result = db.delete(queryHistory).run();
		const deletedCount = result.changes;

		logger.info(`[History] Cleared ${deletedCount} total entries`);
		return { success: true, deletedCount };
	}),

	/**
	 * Get history statistics for a connection
	 */
	stats: publicProcedure
		.input(z.object({ connectionId: z.number().int().positive().optional() }))
		.query(async ({ input }) => {
			const { connectionId } = input;
			const whereClause = connectionId !== undefined
				? eq(queryHistory.connectionId, connectionId)
				: undefined;

			const stats = db
				.select({
					totalQueries: sql<number>`count(*)`,
					successfulQueries: sql<number>`sum(case when success = 1 then 1 else 0 end)`,
					failedQueries: sql<number>`sum(case when success = 0 then 1 else 0 end)`,
					avgExecutionTimeMs: sql<number>`avg(execution_time_ms)`,
					totalRowsReturned: sql<number>`sum(row_count)`,
				})
				.from(queryHistory)
				.where(whereClause)
				.get();

			return {
				totalQueries: stats?.totalQueries ?? 0,
				successfulQueries: stats?.successfulQueries ?? 0,
				failedQueries: stats?.failedQueries ?? 0,
				avgExecutionTimeMs: stats?.avgExecutionTimeMs ? Math.round(stats.avgExecutionTimeMs) : null,
				totalRowsReturned: stats?.totalRowsReturned ?? 0,
			};
		}),
});
