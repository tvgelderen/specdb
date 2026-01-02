import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import { logging } from "~/trpc/middleware/logging";
import { rateLimit } from "~/trpc/middleware/rate-limit";
import { requirePermission, withUserContext } from "~/trpc/middleware/permission";
import { PostgresProvider } from "~/providers/postgres/provider";
import { SqliteProvider } from "~/providers/sqlite/provider";
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

/**
 * Union type for supported database providers
 */
type DatabaseProvider = PostgresProvider | SqliteProvider;

/**
 * Provider info including the provider instance and type
 */
interface ProviderInfo {
	provider: DatabaseProvider;
	type: "postgres" | "sqlite";
}

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
 * Get database provider from the active connection stored in the database
 * Supports both PostgreSQL and SQLite connections
 * Falls back to environment variables for PostgreSQL if no active connection is found
 * @param connectionId - Optional connection ID (reserved for future multi-connection support)
 * @param database - Optional database name to override the connection's default database
 */
async function getProviderInfo(connectionId?: string, database?: string): Promise<ProviderInfo> {
	// First, try to get the active connection from the database
	const activeConnection = db
		.select()
		.from(connections)
		.where(eq(connections.isActive, true))
		.get();

	if (activeConnection) {
		// Handle SQLite connections
		if (activeConnection.providerType === "sqlite") {
			const sqliteConfig = activeConnection.sqliteConfig ? JSON.parse(activeConnection.sqliteConfig) : null;

			if (!sqliteConfig?.filepath) {
				throw new Error("SQLite connection is missing file path configuration");
			}

			logger.debug("[Explorer] Using SQLite connection from database", {
				connectionId: activeConnection.id,
				name: activeConnection.name,
				filepath: sqliteConfig.filepath,
			});

			const provider = new SqliteProvider({
				filepath: sqliteConfig.filepath,
				readonly: sqliteConfig.readonly ?? false,
				fileMustExist: sqliteConfig.fileMustExist ?? true,
				enableWAL: sqliteConfig.enableWAL ?? true,
				enableForeignKeys: sqliteConfig.enableForeignKeys ?? true,
			});
			await provider.connect();
			return { provider, type: "sqlite" };
		}

		// Handle PostgreSQL connections
		const decryptedPassword = decrypt(activeConnection.encryptedPassword ?? "");
		const sslConfig = activeConnection.sslConfig ? JSON.parse(activeConnection.sslConfig) : null;

		const config = {
			host: activeConnection.host ?? "localhost",
			port: activeConnection.port ?? 5432,
			user: activeConnection.username ?? "",
			password: decryptedPassword,
			// Use the provided database if specified, otherwise use the connection's default
			database: database ?? activeConnection.database ?? "",
			max: activeConnection.maxPoolSize ?? 10,
			idleTimeoutMillis: activeConnection.idleTimeoutMs ?? 30000,
			connectionTimeoutMillis: activeConnection.connectionTimeoutMs ?? 5000,
			ssl: sslConfig?.enabled
				? sslConfig.rejectUnauthorized !== undefined
					? { rejectUnauthorized: sslConfig.rejectUnauthorized }
					: true
				: undefined,
		};

		logger.debug("[Explorer] Using PostgreSQL connection from database", {
			connectionId: activeConnection.id,
			name: activeConnection.name,
			database: config.database,
		});

		const provider = new PostgresProvider(config);
		await provider.connect();
		return { provider, type: "postgres" };
	}

	// Fallback to environment variables if no active connection (PostgreSQL only)
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
	return { provider, type: "postgres" };
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
 * Input schema for deleteRows
 */
const deleteRowsInput = z.object({
	connectionId: z.string().optional(),
	database: z.string().optional(),
	schema: z.string().default("public"),
	table: z.string(),
	/** Primary key column name */
	primaryKeyColumn: z.string(),
	/** Primary key values of rows to delete */
	primaryKeyValues: z.array(z.unknown()).min(1),
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
		.use(rateLimit({ limit: 10000, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.databases.list"))
		.input(listDatabasesInput)
		.query(async ({ input }): Promise<PaginatedExplorerResponse<ExplorerDatabaseInfo>> => {
			const startTime = Date.now();
			logger.info("[Explorer] listDatabases called", {
				connectionId: input.connectionId,
				pagination: input.pagination,
			});

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId);

				const pagination = {
					limit: input.pagination?.limit ?? EXPLORER_DEFAULT_LIMIT,
					offset: input.pagination?.offset ?? 0,
				};

				let items: ExplorerDatabaseInfo[];
				let result: { total: number; offset: number; limit: number; hasMore: boolean };

				if (providerInfo.type === "sqlite") {
					const sqliteProvider = providerInfo.provider as SqliteProvider;
					const sqliteResult = await sqliteProvider.listDatabasesPaginated(pagination);
					items = sqliteResult.items.map((db) => ({
						name: db.name,
						owner: "", // SQLite doesn't have owners
						encoding: "UTF-8", // SQLite uses UTF-8
						size: db.size,
						tablespace: "", // SQLite doesn't have tablespaces
						treeMeta: createDatabaseTreeMeta(db.name),
					}));
					result = sqliteResult;
				} else {
					const pgProvider = providerInfo.provider as PostgresProvider;
					const pgResult = await pgProvider.listDatabasesPaginated(pagination);
					items = pgResult.items.map((db) => ({
						name: db.name,
						owner: db.owner,
						encoding: db.encoding,
						size: db.size,
						tablespace: db.tablespace,
						treeMeta: createDatabaseTreeMeta(db.name),
					}));
					result = pgResult;
				}

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
					message: error instanceof Error ? error.message : "Failed to list databases",
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
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
		.use(rateLimit({ limit: 10000, windowInSeconds: 60 }))
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

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId, input.database);

				const pagination = {
					limit: input.pagination?.limit ?? EXPLORER_DEFAULT_LIMIT,
					offset: input.pagination?.offset ?? 0,
				};

				let items: ExplorerSchemaInfo[];
				let result: { total: number; offset: number; limit: number; hasMore: boolean };

				if (providerInfo.type === "sqlite") {
					const sqliteProvider = providerInfo.provider as SqliteProvider;
					const sqliteResult = await sqliteProvider.listSchemasPaginated(pagination, input.database);
					items = sqliteResult.items.map((schema) => ({
						name: schema.name,
						owner: schema.owner,
						database: schema.database,
						treeMeta: createSchemaTreeMeta(schema.database, schema.name),
					}));
					result = sqliteResult;
				} else {
					const pgProvider = providerInfo.provider as PostgresProvider;
					const pgResult = await pgProvider.listSchemasPaginated(pagination, input.database);
					items = pgResult.items.map((schema) => ({
						name: schema.name,
						owner: schema.owner,
						database: schema.database,
						treeMeta: createSchemaTreeMeta(schema.database, schema.name),
					}));
					result = pgResult;
				}

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
					message: error instanceof Error ? error.message : "Failed to list schemas",
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
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
		.use(rateLimit({ limit: 10000, windowInSeconds: 60 }))
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

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId, input.database);

				const pagination = {
					limit: input.pagination?.limit ?? EXPLORER_DEFAULT_LIMIT,
					offset: input.pagination?.offset ?? 0,
				};

				// For SQLite, use "main" schema if "public" was requested (default for PostgreSQL)
				const schema = providerInfo.type === "sqlite" && input.schema === "public" ? "main" : input.schema;

				let items: ExplorerTableInfo[];
				let result: { total: number; offset: number; limit: number; hasMore: boolean };

				if (providerInfo.type === "sqlite") {
					const sqliteProvider = providerInfo.provider as SqliteProvider;
					const sqliteResult = await sqliteProvider.listTablesPaginated(schema, pagination);
					items = sqliteResult.items.map((table) => ({
						name: table.name,
						schema: table.schema,
						type: table.type as "table" | "view" | "materialized_view",
						owner: table.owner,
						rowCount: table.rowCount,
						size: table.size,
						treeMeta: createTableTreeMeta(table.schema, table.name, table.type as "table" | "view" | "materialized_view"),
					}));
					result = sqliteResult;
				} else {
					const pgProvider = providerInfo.provider as PostgresProvider;
					const pgResult = await pgProvider.listTablesPaginated(schema, pagination);
					items = pgResult.items.map((table) => ({
						name: table.name,
						schema: table.schema,
						type: table.type,
						owner: table.owner,
						rowCount: table.rowCount,
						size: table.size,
						treeMeta: createTableTreeMeta(table.schema, table.name, table.type),
					}));
					result = pgResult;
				}

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
					message: error instanceof Error ? error.message : "Failed to list tables",
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
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
				providerType: activeConnection?.providerType ?? null,
			};
		}),

	/**
	 * Get table data (rows) using the active connection
	 */
	getTableData: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 10000, windowInSeconds: 60 }))
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

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId, input.database);

				// For SQLite, use "main" schema if "public" was requested (default for PostgreSQL)
				const schema = providerInfo.type === "sqlite" && input.schema === "public" ? "main" : input.schema;

				// Get table data
				const result = await providerInfo.provider.selectRows({
					schema,
					table: input.table,
					limit: input.limit,
					offset: input.offset,
				});

				// Get row count
				const countResult = await providerInfo.provider.countRows({
					schema,
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
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
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
		.use(rateLimit({ limit: 10000, windowInSeconds: 60 }))
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

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId, input.database);

				// For SQLite, use "main" schema if "public" was requested (default for PostgreSQL)
				const schema = providerInfo.type === "sqlite" && input.schema === "public" ? "main" : input.schema;

				const structure = await providerInfo.provider.getTableStructure(schema, input.table);

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
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Get active connections to a database (PostgreSQL only)
	 */
	getDatabaseConnections: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 10000, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.databases.list"))
		.input(getDatabaseConnectionsInput)
		.query(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] getDatabaseConnections called", {
				connectionId: input.connectionId,
				databaseName: input.databaseName,
			});

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId);

				// This is a PostgreSQL-specific operation
				if (providerInfo.type === "sqlite") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "getDatabaseConnections is not supported for SQLite databases",
					});
				}

				const pgProvider = providerInfo.provider as PostgresProvider;
				const result = await pgProvider.getDatabaseConnections(input.databaseName);

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
				if (error instanceof TRPCError) {
					throw error;
				}
				logger.error("[Explorer] getDatabaseConnections failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to get database connections: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Create a new database (PostgreSQL only)
	 */
	createDatabase: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 1000, windowInSeconds: 60 }))
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

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId);

				// This is a PostgreSQL-specific operation
				if (providerInfo.type === "sqlite") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "createDatabase is not supported for SQLite. SQLite databases are created by opening a new file.",
					});
				}

				const pgProvider = providerInfo.provider as PostgresProvider;
				await pgProvider.createDatabase(input.databaseName, {
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
				if (error instanceof TRPCError) {
					throw error;
				}
				logger.error("[Explorer] createDatabase failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to create database: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Rename a database (PostgreSQL only)
	 */
	renameDatabase: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 1000, windowInSeconds: 60 }))
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

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId);

				// This is a PostgreSQL-specific operation
				if (providerInfo.type === "sqlite") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "renameDatabase is not supported for SQLite. Rename the database file directly.",
					});
				}

				const pgProvider = providerInfo.provider as PostgresProvider;
				await pgProvider.renameDatabase(input.oldName, input.newName, input.force);

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
				if (error instanceof TRPCError) {
					throw error;
				}
				logger.error("[Explorer] renameDatabase failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to rename database: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Delete a database (PostgreSQL only)
	 */
	deleteDatabase: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 1000, windowInSeconds: 60 }))
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

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId);

				// This is a PostgreSQL-specific operation
				if (providerInfo.type === "sqlite") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "deleteDatabase is not supported for SQLite. Delete the database file directly.",
					});
				}

				const pgProvider = providerInfo.provider as PostgresProvider;
				await pgProvider.deleteDatabase(input.databaseName, input.force);

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
				if (error instanceof TRPCError) {
					throw error;
				}
				logger.error("[Explorer] deleteDatabase failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to delete database: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),

	/**
	 * Delete rows from a table by primary key values
	 */
	deleteRows: publicProcedure
		.use(logging)
		.use(rateLimit({ limit: 1000, windowInSeconds: 60 }))
		.use(withUserContext)
		.use(requirePermission("explorer.tables.write"))
		.input(deleteRowsInput)
		.mutation(async ({ input }) => {
			const startTime = Date.now();
			logger.info("[Explorer] deleteRows called", {
				connectionId: input.connectionId,
				database: input.database,
				schema: input.schema,
				table: input.table,
				primaryKeyColumn: input.primaryKeyColumn,
				rowCount: input.primaryKeyValues.length,
			});

			let providerInfo: ProviderInfo | null = null;
			try {
				providerInfo = await getProviderInfo(input.connectionId, input.database);

				// For SQLite, use "main" schema if "public" was requested
				const schema = providerInfo.type === "sqlite" && input.schema === "public" ? "main" : input.schema;

				const result = await providerInfo.provider.deleteRows({
					schema,
					table: input.table,
					where: [
						{
							column: input.primaryKeyColumn,
							operator: "IN",
							value: input.primaryKeyValues,
						},
					],
				});

				logger.info("[Explorer] deleteRows completed", {
					table: input.table,
					deletedCount: result.rowCount,
					durationMs: Date.now() - startTime,
				});

				return {
					success: true,
					deletedCount: result.rowCount,
					timestamp: Date.now(),
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				logger.error("[Explorer] deleteRows failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to delete rows: ${error instanceof Error ? error.message : "Unknown error"}`,
					cause: error,
				});
			} finally {
				if (providerInfo) {
					await providerInfo.provider.disconnect().catch((err) => {
						logger.warn("[Explorer] Failed to disconnect provider", err);
					});
				}
			}
		}),
});

export type ExplorerRouter = typeof explorerRouter;
