import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

/**
 * Connections table - stores database connection configurations
 * Credentials (password) are encrypted using AES-256-GCM
 */
export const connections = sqliteTable(
	"connections",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		name: text().notNull(),
		providerType: text("provider_type").notNull(), // 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'redis'
		host: text().notNull(),
		port: integer().notNull(),
		database: text().notNull(),
		username: text().notNull(),
		// Encrypted password (base64 encoded: IV + AuthTag + Ciphertext)
		encryptedPassword: text("encrypted_password").notNull(),
		// SSL configuration stored as JSON
		sslConfig: text("ssl_config"), // JSON: { enabled: boolean, rejectUnauthorized?: boolean }
		// Connection pool settings
		maxPoolSize: integer("max_pool_size").default(10),
		idleTimeoutMs: integer("idle_timeout_ms").default(30000),
		connectionTimeoutMs: integer("connection_timeout_ms").default(5000),
		// Active connection flag - only one connection can be active at a time
		isActive: integer("is_active", { mode: "boolean" }).default(false).notNull(),
		// Metadata
		color: text(), // Optional color for UI display
		notes: text(), // Optional notes/description
		createdAt: text("created_at")
			.default(sql`(datetime('now'))`)
			.notNull(),
		updatedAt: text("updated_at")
			.default(sql`(datetime('now'))`)
			.notNull(),
	},
	(table) => [
		index("connections_provider_type_idx").on(table.providerType),
		index("connections_is_active_idx").on(table.isActive),
		index("connections_name_idx").on(table.name),
	]
);

/**
 * Connection type inference for TypeScript
 */
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;

/**
 * Query history table - stores executed queries for each connection
 * Tracks execution metrics, timestamps, and success/failure status
 */
export const queryHistory = sqliteTable(
	"query_history",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		connectionId: integer("connection_id").notNull(),
		queryText: text("query_text").notNull(),
		// Execution metrics
		executionTimeMs: integer("execution_time_ms"),
		rowCount: integer("row_count"),
		// Status
		success: integer({ mode: "boolean" }).default(true).notNull(),
		errorMessage: text("error_message"),
		// Timestamps
		executedAt: text("executed_at")
			.default(sql`(datetime('now'))`)
			.notNull(),
	},
	(table) => [
		index("query_history_connection_id_idx").on(table.connectionId),
		index("query_history_executed_at_idx").on(table.executedAt),
		index("query_history_success_idx").on(table.success),
	]
);

/**
 * Query history type inference for TypeScript
 */
export type QueryHistory = typeof queryHistory.$inferSelect;
export type NewQueryHistory = typeof queryHistory.$inferInsert;

/**
 * Settings table - stores application settings/preferences
 * Uses a key-value structure for flexibility
 */
export const settings = sqliteTable(
	"settings",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		key: text().notNull().unique(),
		value: text().notNull(), // JSON serialized value
		createdAt: text("created_at")
			.default(sql`(datetime('now'))`)
			.notNull(),
		updatedAt: text("updated_at")
			.default(sql`(datetime('now'))`)
			.notNull(),
	},
	(table) => [index("settings_key_idx").on(table.key)]
);

/**
 * Settings type inference for TypeScript
 */
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

/**
 * Available settings keys and their types
 */
export interface AppSettings {
	/** Whether to show warnings for destructive SQL operations */
	warnOnDestructiveQueries: boolean;
}
