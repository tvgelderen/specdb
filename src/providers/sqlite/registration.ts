import { ProviderRegistry } from "~/providers/db-provider/registry";
import type { DbCapability, ProviderRegistration } from "~/providers/db-provider/types";
import { SqliteDbProviderAdapter } from "./db-provider-adapter";
import type { SqliteConnectionConfig } from "./types";

/**
 * SQLite provider capabilities
 */
const SQLITE_CAPABILITIES: DbCapability[] = [
	"connection.test",
	"metadata.schemas",
	"metadata.tables",
	"metadata.columns",
	"metadata.indexes",
	"metadata.constraints",
	"metadata.tableStructure",
	"data.select",
	"data.insert",
	"data.update",
	"data.delete",
	"data.rawQuery",
	"transaction.basic",
];

/**
 * SQLite provider registration
 */
export const sqliteRegistration: ProviderRegistration<SqliteConnectionConfig> = {
	type: "sqlite",
	name: "SQLite",
	description: "SQLite file-based database provider with full CRUD support and metadata inspection",
	version: "1.0.0",
	capabilities: SQLITE_CAPABILITIES,
	factory: (config: SqliteConnectionConfig) => new SqliteDbProviderAdapter(config),
};

/**
 * Register the SQLite provider with the global registry
 */
export function registerSqliteProvider(): void {
	ProviderRegistry.register(sqliteRegistration);
}

// Auto-register when this module is imported
registerSqliteProvider();
