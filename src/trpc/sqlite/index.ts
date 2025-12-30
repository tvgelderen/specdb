import { z } from "zod/v4";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import {
	SqliteProvider,
	DEFAULT_QUERY_LIMIT,
	DEFAULT_QUERY_TIMEOUT_MS,
	MAX_QUERY_LIMIT,
	MAX_QUERY_TIMEOUT_MS,
} from "~/providers/sqlite";
import logger from "~/lib/logging";

const connectionConfigSchema = z.object({
	filepath: z.string().min(1, "File path is required"),
	readonly: z.boolean().optional(),
	timeout: z.number().int().min(100).max(60000).optional(),
	fileMustExist: z.boolean().optional(),
	enableWAL: z.boolean().optional(),
	enableForeignKeys: z.boolean().optional(),
});

const rowFilterSchema = z.object({
	column: z.string().min(1),
	operator: z.enum([
		"=",
		"!=",
		">",
		"<",
		">=",
		"<=",
		"LIKE",
		"GLOB",
		"IN",
		"IS NULL",
		"IS NOT NULL",
	]),
	value: z.unknown(),
});

const orderBySchema = z.object({
	column: z.string().min(1),
	direction: z.enum(["ASC", "DESC"]),
});

const providerCache = new Map<string, SqliteProvider>();

function getProviderCacheKey(config: z.infer<typeof connectionConfigSchema>): string {
	return config.filepath;
}

async function getProvider(
	config: z.infer<typeof connectionConfigSchema>
): Promise<SqliteProvider> {
	const cacheKey = getProviderCacheKey(config);

	let provider = providerCache.get(cacheKey);
	if (!provider) {
		provider = new SqliteProvider(config);
		await provider.connect();
		providerCache.set(cacheKey, provider);
		logger.info(`[SqliteRouter] Created new provider for ${cacheKey}`);
	}

	return provider;
}

export const sqliteRouter = router({
	testConnection: publicProcedure
		.input(connectionConfigSchema)
		.mutation(async ({ input }) => {
			const provider = new SqliteProvider(input);
			try {
				await provider.connect();
				const version = await provider.getVersion();
				await provider.disconnect();
				return { success: true, message: `Connected to SQLite ${version}` };
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error";
				return { success: false, message };
			}
		}),

	listDatabases: publicProcedure
		.input(connectionConfigSchema)
		.query(async ({ input }) => {
			const provider = await getProvider(input);
			return provider.listDatabases();
		}),

	listSchemas: publicProcedure
		.input(connectionConfigSchema)
		.query(async ({ input }) => {
			const provider = await getProvider(input);
			return provider.listSchemas();
		}),

	listTables: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().default("main"),
			})
		)
		.query(async ({ input }) => {
			const { schema, ...config } = input;
			const provider = await getProvider(config);
			return provider.listTables(schema);
		}),

	getTableStructure: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().default("main"),
				table: z.string().min(1),
			})
		)
		.query(async ({ input }) => {
			const { schema, table, ...config } = input;
			const provider = await getProvider(config);
			return provider.getTableStructure(schema, table);
		}),

	getColumns: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().default("main"),
				table: z.string().min(1),
			})
		)
		.query(async ({ input }) => {
			const { schema, table, ...config } = input;
			const provider = await getProvider(config);
			return provider.getColumns(schema, table);
		}),

	getIndexes: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().default("main"),
				table: z.string().min(1),
			})
		)
		.query(async ({ input }) => {
			const { schema, table, ...config } = input;
			const provider = await getProvider(config);
			return provider.getIndexes(schema, table);
		}),

	getConstraints: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().default("main"),
				table: z.string().min(1),
			})
		)
		.query(async ({ input }) => {
			const { schema, table, ...config } = input;
			const provider = await getProvider(config);
			return provider.getConstraints(schema, table);
		}),

	selectRows: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				columns: z.array(z.string().min(1)).optional(),
				filters: z.array(rowFilterSchema).optional(),
				orderBy: z.array(orderBySchema).optional(),
				limit: z.number().int().min(1).max(10000).optional(),
				offset: z.number().int().min(0).optional(),
			})
		)
		.query(async ({ input }) => {
			const { schema, table, columns, filters, orderBy, limit, offset, ...config } =
				input;
			const provider = await getProvider(config);
			return provider.selectRows({
				schema,
				table,
				columns,
				filters,
				orderBy,
				limit,
				offset,
			});
		}),

	getRows: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				columns: z.array(z.string().min(1)).optional(),
				filters: z.array(rowFilterSchema).optional(),
				orderBy: z.array(orderBySchema).optional(),
				limit: z.number().int().min(1).max(MAX_QUERY_LIMIT).default(DEFAULT_QUERY_LIMIT),
				offset: z.number().int().min(0).default(0),
				queryTimeoutMs: z
					.number()
					.int()
					.min(100)
					.max(MAX_QUERY_TIMEOUT_MS)
					.default(DEFAULT_QUERY_TIMEOUT_MS),
			})
		)
		.query(async ({ input }) => {
			const handlerStartTime = performance.now();
			const {
				schema,
				table,
				columns,
				filters,
				orderBy,
				limit,
				offset,
				queryTimeoutMs,
				...config
			} = input;
			const provider = await getProvider(config);
			logger.debug(
				`[SqliteRouter] getRows: ${schema ?? "main"}.${table}, limit=${limit}, offset=${offset}`
			);
			const result = await provider.selectRows({
				schema,
				table,
				columns,
				filters,
				orderBy,
				limit,
				offset,
				queryTimeoutMs,
			});
			// Set total handler duration
			if (result.timing) {
				result.timing.totalMs = Math.round(performance.now() - handlerStartTime);
			}
			return result;
		}),

	getRowCount: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				filters: z.array(rowFilterSchema).optional(),
				queryTimeoutMs: z
					.number()
					.int()
					.min(100)
					.max(MAX_QUERY_TIMEOUT_MS)
					.default(DEFAULT_QUERY_TIMEOUT_MS),
			})
		)
		.query(async ({ input }) => {
			const { schema, table, filters, queryTimeoutMs, ...config } = input;
			const provider = await getProvider(config);
			logger.debug(`[SqliteRouter] getRowCount: ${schema ?? "main"}.${table}`);
			return provider.countRows({
				schema,
				table,
				filters,
				queryTimeoutMs,
			});
		}),

	insertRow: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				data: z.record(z.string(), z.unknown()),
			})
		)
		.mutation(async ({ input }) => {
			const { schema, table, data, ...config } = input;
			const provider = await getProvider(config);
			return provider.insertRow({ schema, table, data });
		}),

	updateRows: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				data: z.record(z.string(), z.unknown()),
				where: z.array(rowFilterSchema).min(1),
			})
		)
		.mutation(async ({ input }) => {
			const { schema, table, data, where, ...config } = input;
			const provider = await getProvider(config);
			return provider.updateRows({ schema, table, data, where });
		}),

	deleteRows: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				where: z.array(rowFilterSchema).min(1),
			})
		)
		.mutation(async ({ input }) => {
			const { schema, table, where, ...config } = input;
			const provider = await getProvider(config);
			return provider.deleteRows({ schema, table, where });
		}),

	updateRow: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				data: z.record(z.string(), z.unknown()),
				where: z.array(rowFilterSchema).min(1),
			})
		)
		.mutation(async ({ input }) => {
			const { schema, table, data, where, ...config } = input;
			const provider = await getProvider(config);
			logger.debug(`[SqliteRouter] updateRow: ${schema ?? "main"}.${table}`);
			const result = await provider.updateRows({ schema, table, data, where });
			if (result.rowCount === 0) {
				throw new Error("No rows matched the update criteria");
			}
			if (result.rowCount > 1) {
				throw new Error(
					`Expected to update 1 row, but ${result.rowCount} rows matched. Use updateRows for batch updates.`
				);
			}
			return result;
		}),

	deleteRow: publicProcedure
		.input(
			connectionConfigSchema.extend({
				schema: z.string().optional(),
				table: z.string().min(1),
				where: z.array(rowFilterSchema).min(1),
			})
		)
		.mutation(async ({ input }) => {
			const { schema, table, where, ...config } = input;
			const provider = await getProvider(config);
			logger.debug(`[SqliteRouter] deleteRow: ${schema ?? "main"}.${table}`);
			const result = await provider.deleteRows({ schema, table, where });
			if (result.rowCount === 0) {
				throw new Error("No rows matched the delete criteria");
			}
			if (result.rowCount > 1) {
				throw new Error(
					`Expected to delete 1 row, but ${result.rowCount} rows matched. Use deleteRows for batch deletes.`
				);
			}
			return result;
		}),

	executeQuery: publicProcedure
		.input(
			connectionConfigSchema.extend({
				sql: z.string().min(1),
				params: z.array(z.unknown()).optional(),
			})
		)
		.mutation(async ({ input }) => {
			const handlerStartTime = performance.now();
			const { sql, params, ...config } = input;
			const provider = await getProvider(config);
			const result = await provider.executeQuery(sql, params ?? []);
			// Set total handler duration
			if (result.timing) {
				result.timing.totalMs = Math.round(performance.now() - handlerStartTime);
			}
			return result;
		}),

	// SQLite-specific endpoints
	getVersion: publicProcedure
		.input(connectionConfigSchema)
		.query(async ({ input }) => {
			const provider = await getProvider(input);
			return provider.getVersion();
		}),

	getFileSize: publicProcedure
		.input(connectionConfigSchema)
		.query(async ({ input }) => {
			const provider = await getProvider(input);
			return provider.getFileSize();
		}),

	vacuum: publicProcedure
		.input(connectionConfigSchema)
		.mutation(async ({ input }) => {
			const provider = await getProvider(input);
			await provider.vacuum();
			return { success: true, message: "Database vacuumed successfully" };
		}),

	integrityCheck: publicProcedure
		.input(connectionConfigSchema)
		.query(async ({ input }) => {
			const provider = await getProvider(input);
			return provider.integrityCheck();
		}),
});
