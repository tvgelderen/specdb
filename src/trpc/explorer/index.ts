import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import { logging } from "~/trpc/middleware/logging";
import { rateLimit } from "~/trpc/middleware/rate-limit";
import { requirePermission, withUserContext } from "~/trpc/middleware/permission";
import { PostgresProvider } from "~/providers/postgres/provider";
import { db } from "~/db";
import { connections } from "~/db/schema";
import { decrypt } from "~/lib/encryption";
import logger from "~/lib/logging";
import {
	paginationSchema,
	EXPLORER_DEFAULT_LIMIT,
	type ExplorerDatabaseInfo,
	type ExplorerSchemaInfo,
	type ExplorerTableInfo,
	type PaginatedExplorerResponse,
	type TreeNodeMeta,
} from "./types";

// Re-export types for consumers
export * from "./types";

/**
 * Create a tree node ID for consistent identification
 */
function createTreeNodeId(type: string, ...parts: string[]): string {
	return [type, ...parts].join(":");
}

/**
 * Create tree metadata for a database node
 */
function createDatabaseTreeMeta(name: string): TreeNodeMeta {
	return {
		id: createTreeNodeId("database", name),
		type: "database",
		isExpandable: true,
		icon: "database",
		context: { database: name },
	};
}

/**
 * Create tree metadata for a schema node
 */
function createSchemaTreeMeta(database: string, schemaName: string): TreeNodeMeta {
	return {
		id: createTreeNodeId("schema", database, schemaName),
		type: "schema",
		isExpandable: true,
		icon: "folder",
		context: { database, schema: schemaName },
	};
}

/**
 * Create tree metadata for a table node
 */
function createTableTreeMeta(
	schema: string,
	tableName: string,
	tableType: "table" | "view" | "materialized_view"
): TreeNodeMeta {
	const iconMap = {
		table: "table",
		view: "eye",
		materialized_view: "layers",
	};

	return {
		id: createTreeNodeId(tableType, schema, tableName),
		type: tableType === "materialized_view" ? "materialized_view" : tableType,
		isExpandable: false,
		icon: iconMap[tableType],
		context: { schema, table: tableName, tableType },
	};
}

/**
 * Get PostgresProvider from the active connection stored in the database
 * Falls back to environment variables if no active connection is found
 * @param connectionId - Optional connection ID (reserved for future multi-connection support)
 * @param database - Optional database name to override the connection's default database
 */
async function getProvider(connectionId?: string, database?: string): Promise<PostgresProvider> {
	// First, try to get the active connection from the database
	const activeConnection = db
		.select()
		.from(connections)
		.where(eq(connections.isActive, true))
		.get();

	if (activeConnection) {
		// Decrypt the password and build the config from the active connection
		const decryptedPassword = decrypt(activeConnection.encryptedPassword);
		const sslConfig = activeConnection.sslConfig ? JSON.parse(activeConnection.sslConfig) : null;

		const config = {
			host: activeConnection.host,
			port: activeConnection.port,
			user: activeConnection.username,
			password: decryptedPassword,
			// Use the provided database if specified, otherwise use the connection's default
			database: database ?? activeConnection.database,
			max: activeConnection.maxPoolSize ?? 10,
			idleTimeoutMillis: activeConnection.idleTimeoutMs ?? 30000,
			connectionTimeoutMillis: activeConnection.connectionTimeoutMs ?? 5000,
			ssl: sslConfig?.enabled
				? sslConfig.rejectUnauthorized !== undefined
					? { rejectUnauthorized: sslConfig.rejectUnauthorized }
					: true
				: undefined,
		};

		logger.debug("[Explorer] Using active connection from database", {
			connectionId: activeConnection.id,
			name: activeConnection.name,
			database: config.database,
		});

		const provider = new PostgresProvider(config);
		await provider.connect();
		return provider;
	}

	// Fallback to environment variables if no active connection
	logger.debug("[Explorer] No active connection found, falling back to environment variables");
	const config = {
		host: process.env.POSTGRES_HOST ?? "localhost",
		port: parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
		user: process.env.POSTGRES_USER ?? "postgres",
		password: process.env.POSTGRES_PASSWORD ?? "",
		// Use the provided database if specified, otherwise use the environment variable
		database: database ?? process.env.POSTGRES_DATABASE ?? "postgres",
	};

	const provider = new PostgresProvider(config);
	await provider.connect();
	return provider;
}

/**
 * Input schema for listDatabases
 */
const listDatabasesInput = z.object({
	connectionId: z.string().optional(),
	pagination: paginationSchema.optional(),
});

/**
 * Input schema for listSchemas
 */
const listSchemasInput = z.object({
	connectionId: z.string().optional(),
	database: z.string().optional(),
	pagination: paginationSchema.optional(),
});

/**
 * Input schema for listTables
 */
const listTablesInput = z.object({
	connectionId: z.string().optional(),
	database: z.string().optional(),
	schema: z.string().default("public"),
	pagination: paginationSchema.optional(),
});

/**
 * Input schema for getTableData
 */
const getTableDataInput = z.object({
	connectionId: z.string().optional(),
	database: z.string().optional(),
	schema: z.string().default("public"),
	table: z.string(),
	limit: z.number().int().min(1).max(10000).default(1000),
	offset: z.number().int().min(0).default(0),
});

/**
 * Input schema for getTableStructure
 */
const getTableStructureInput = z.object({
	connectionId: z.string().optional(),
	database: z.string().optional(),
	schema: z.string().default("public"),
	table: z.string(),
});

/**
 * Input schema for hasActiveConnection
 */
const hasActiveConnectionInput = z.object({
	connectionId: z.string().optional(),
});

/**
 * Input schema for renameDatabase
 */
const renameDatabaseInput = z.object({
	connectionId: z.string().optional(),
	oldName: z.string().min(1),
	newName: z.string().min(1),
	/** If true, terminate existing connections before renaming */
	force: z.boolean().optional().default(false),
});

/**
 * Input schema for createDatabase
 */
const createDatabaseInput = z.object({
	connectionId: z.string().optional(),
	databaseName: z.string().min(1),
	/** Optional owner for the new database */
	owner: z.string().optional(),
	/** Optional encoding (defaults to UTF8) */
	encoding: z.string().optional(),
	/** Optional template database (defaults to template1) */
	template: z.string().optional(),
});

/**
 * Input schema for deleteDatabase
 */
const deleteDatabaseInput = z.object({
	connectionId: z.string().optional(),
	databaseName: z.string().min(1),
	/** If true, terminate existing connections before deleting */
	force: z.boolean().optional().default(false),
});

/**
 * Input schema for getDatabaseConnections
 */
const getDatabaseConnectionsInput = z.object({
	connectionId: z.string().optional(),
	databaseName: z.string().min(1),
});

/**
 * Explorer router with tree population procedures
 */
export const explorerRouter = router({
	/**
	 * List all accessible databases with pagination and tree metadata
	 */
	listDatabases: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 100, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.databases.list"))
		.input(listDatabasesInput)
		.query(async ({ input }): Promise<PaginatedExplorerResponse<ExplorerDatabaseInfo>> => {
			const startTime = Date.now();
			logger.info("[Explorer] listDatabases called", {
				connectionId: input.connectionId,
				pagination: input.pagination,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId);

				const pagination = {
					limit: input.pagination?.limit ?? EXPLORER_DEFAULT_LIMIT,
					offset: input.pagination?.offset ?? 0,
				};

				const result = await provider.listDatabasesPaginated(pagination);

				const items: ExplorerDatabaseInfo[] = result.items.map((db) => ({
					name: db.name,
					owner: db.owner,
					encoding: db.encoding,
					size: db.size,
					tablespace: db.tablespace,
					treeMeta: createDatabaseTreeMeta(db.name),
				}));

				logger.info("[Explorer] listDatabases completed", {
					count: items.length,
					total: result.total,
					durationMs: Date.now() - startTime,
				});

				return {
					items,
					pagination: {
						offset: result.offset,
						limit: result.limit,
						total: result.total,
						hasMore: result.hasMore,
					},
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] listDatabases failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list databases",
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * List all schemas in a database with pagination and tree metadata
	 */
	listSchemas: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 100, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.schemas.list"))
		.input(listSchemasInput)
		.query(async ({ input }): Promise<PaginatedExplorerResponse<ExplorerSchemaInfo>> => {
			const startTime = Date.now();
			logger.info("[Explorer] listSchemas called", {
				connectionId: input.connectionId,
				database: input.database,
				pagination: input.pagination,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId, input.database);

				const pagination = {
					limit: input.pagination?.limit ?? EXPLORER_DEFAULT_LIMIT,
					offset: input.pagination?.offset ?? 0,
				};

				const result = await provider.listSchemasPaginated(pagination, input.database);

				const items: ExplorerSchemaInfo[] = result.items.map((schema) => ({
					name: schema.name,
					owner: schema.owner,
					database: schema.database,
					treeMeta: createSchemaTreeMeta(schema.database, schema.name),
				}));

				logger.info("[Explorer] listSchemas completed", {
					count: items.length,
					total: result.total,
					durationMs: Date.now() - startTime,
				});

				return {
					items,
					pagination: {
						offset: result.offset,
						limit: result.limit,
						total: result.total,
						hasMore: result.hasMore,
					},
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] listSchemas failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list schemas",
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * List all tables in a schema with pagination and tree metadata
	 */
	listTables: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 100, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.tables.list"))
		.input(listTablesInput)
		.query(async ({ input }): Promise<PaginatedExplorerResponse<ExplorerTableInfo>> => {
			const startTime = Date.now();
			logger.info("[Explorer] listTables called", {
				connectionId: input.connectionId,
				database: input.database,
				schema: input.schema,
				pagination: input.pagination,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId, input.database);

				const pagination = {
					limit: input.pagination?.limit ?? EXPLORER_DEFAULT_LIMIT,
					offset: input.pagination?.offset ?? 0,
				};

				const result = await provider.listTablesPaginated(input.schema, pagination);

				const items: ExplorerTableInfo[] = result.items.map((table) => ({
					name: table.name,
					schema: table.schema,
					type: table.type,
					owner: table.owner,
					rowCount: table.rowCount,
					size: table.size,
					treeMeta: createTableTreeMeta(table.schema, table.name, table.type),
				}));

				logger.info("[Explorer] listTables completed", {
					count: items.length,
					total: result.total,
					durationMs: Date.now() - startTime,
				});

				return {
					items,
					pagination: {
						offset: result.offset,
						limit: result.limit,
						total: result.total,
						hasMore: result.hasMore,
					},
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] listTables failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list tables",
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Check if there's an active connection
	 */
	hasActiveConnection: publicProcedure
		.use(logging)
		.input(hasActiveConnectionInput)
		.query(async ({ input }) => {
			logger.info("[Explorer] hasActiveConnection called", {
				connectionId: input.connectionId,
			});

			const activeConnection = db
				.select()
				.from(connections)
				.where(eq(connections.isActive, true))
				.get();

			return {
				hasConnection: !!activeConnection,
				connectionId: activeConnection?.id ?? null,
				connectionName: activeConnection?.name ?? null,
			};
		}),

	/**
	 * Get table data (rows) using the active connection
	 */
	getTableData: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 100, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.tables.read"))
		.input(getTableDataInput)
		.query(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] getTableData called", {
				connectionId: input.connectionId,
				database: input.database,
				schema: input.schema,
				table: input.table,
				limit: input.limit,
				offset: input.offset,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId, input.database);

				// Get table data
				const result = await provider.selectRows({
					schema: input.schema,
					table: input.table,
					limit: input.limit,
					offset: input.offset,
				});

				// Get row count
				const countResult = await provider.countRows({
					schema: input.schema,
					table: input.table,
				});

				logger.info("[Explorer] getTableData completed", {
					rowCount: result.rows.length,
					totalRows: countResult.count,
					durationMs: Date.now() - startTime,
				});

				return {
					rows: result.rows,
					columns: result.fields.map((field) => ({
						name: field.name,
						dataType: field.dataType,
					})),
					totalRows: countResult.count,
					timing: result.timing,
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] getTableData failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get table data",
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Get table structure (columns, indexes, constraints) using the active connection
	 */
	getTableStructure: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 100, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.tables.read"))
		.input(getTableStructureInput)
		.query(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] getTableStructure called", {
				connectionId: input.connectionId,
				database: input.database,
				schema: input.schema,
				table: input.table,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId, input.database);

				const structure = await provider.getTableStructure(input.schema, input.table);

				logger.info("[Explorer] getTableStructure completed", {
					columnCount: structure.columns.length,
					indexCount: structure.indexes.length,
					constraintCount: structure.constraints.length,
					durationMs: Date.now() - startTime,
				});

				return {
					...structure,
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] getTableStructure failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get table structure",
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Get active connections to a database
	 */
	getDatabaseConnections: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 100, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.databases.list"))
		.input(getDatabaseConnectionsInput)
		.query(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] getDatabaseConnections called", {
				connectionId: input.connectionId,
				databaseName: input.databaseName,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId);

				const result = await provider.getDatabaseConnections(input.databaseName);

				logger.info("[Explorer] getDatabaseConnections completed", {
					databaseName: input.databaseName,
					connectionCount: result.count,
					durationMs: Date.now() - startTime,
				});

				return {
					...result,
					databaseName: input.databaseName,
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] getDatabaseConnections failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to get database connections: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Create a new database
	 */
	createDatabase: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 10, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.databases.write"))
		.input(createDatabaseInput)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] createDatabase called", {
				connectionId: input.connectionId,
				databaseName: input.databaseName,
				owner: input.owner,
				encoding: input.encoding,
				template: input.template,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId);

				await provider.createDatabase(input.databaseName, {
					owner: input.owner,
					encoding: input.encoding,
					template: input.template,
				});

				logger.info("[Explorer] createDatabase completed", {
					databaseName: input.databaseName,
					durationMs: Date.now() - startTime,
				});

				return {
					success: true,
					databaseName: input.databaseName,
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] createDatabase failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to create database: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Rename a database
	 */
	renameDatabase: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 20, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.databases.write"))
		.input(renameDatabaseInput)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] renameDatabase called", {
				connectionId: input.connectionId,
				oldName: input.oldName,
				newName: input.newName,
				force: input.force,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId);

				await provider.renameDatabase(input.oldName, input.newName, input.force);

				logger.info("[Explorer] renameDatabase completed", {
					oldName: input.oldName,
					newName: input.newName,
					force: input.force,
					durationMs: Date.now() - startTime,
				});

				return {
					success: true,
					oldName: input.oldName,
					newName: input.newName,
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] renameDatabase failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to rename database: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Delete a database
	 */
	deleteDatabase: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 10, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.databases.write"))
		.input(deleteDatabaseInput)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] deleteDatabase called", {
				connectionId: input.connectionId,
				databaseName: input.databaseName,
				force: input.force,
			});

			let provider: PostgresProvider | null = null;
			try {
				provider = await getProvider(input.connectionId);

				await provider.deleteDatabase(input.databaseName, input.force);

				logger.info("[Explorer] deleteDatabase completed", {
					databaseName: input.databaseName,
					force: input.force,
					durationMs: Date.now() - startTime,
				});

				return {
					success: true,
					databaseName: input.databaseName,
					timestamp: Date.now(),
				};
			} catch (error) {
				logger.error("[Explorer] deleteDatabase failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to delete database: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (provider) {
					await provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),
});

export type ExplorerRouter = typeof explorerRouter;
