import { ProviderRegistry } from "~/providers/db-provider/registry";
import type { DbCapability, ProviderRegistration } from "~/providers/db-provider/types";
import { PostgresDbProviderAdapter } from "./db-provider-adapter";
import type { PostgresConnectionConfig } from "./types";

/**
 * PostgreSQL provider capabilities
 */
const POSTGRES_CAPABILITIES: DbCapability[] = [
	"connection.test",
	"connection.pool",
	"metadata.databases",
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
	"transaction.savepoints",
	"transaction.isolation",
	"feature.explain",
];

/**
 * PostgreSQL provider registration
 */
export const postgresRegistration: ProviderRegistration<PostgresConnectionConfig> = {
	type: "postgres",
	name: "PostgreSQL",
	description: "PostgreSQL database provider with full CRUD support and metadata inspection",
	version: "1.0.0",
	capabilities: POSTGRES_CAPABILITIES,
	factory: (config: PostgresConnectionConfig) => new PostgresDbProviderAdapter(config),
};

/**
 * Register the PostgreSQL provider with the global registry
 */
export function registerPostgresProvider(): void {
	ProviderRegistry.register(postgresRegistration);
}

// Auto-register when this module is imported
registerPostgresProvider();
