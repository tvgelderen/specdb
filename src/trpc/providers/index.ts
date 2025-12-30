import { z } from "zod/v4";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import { ProviderRegistry } from "~/providers/db-provider/registry";
import type { DbCapability, ProviderType } from "~/providers/db-provider/types";
import logger from "~/lib/logging";

// Import registrations to ensure providers are registered
import "~/providers/postgres/registration";

/**
 * Schema for provider type
 */
const providerTypeSchema = z.enum(["postgres", "mysql", "sqlite", "mongodb", "redis"]);

/**
 * Schema for capability
 */
const capabilitySchema = z.string();

/**
 * TRPC router for provider registry and capability detection
 */
export const providersRouter = router({
	/**
	 * List all registered providers
	 */
	listProviders: publicProcedure.query(() => {
		const registrations = ProviderRegistry.getAllRegistrations();
		return registrations.map((reg) => ({
			type: reg.type,
			name: reg.name,
			description: reg.description,
			version: reg.version,
			capabilities: reg.capabilities,
		}));
	}),

	/**
	 * Get provider types
	 */
	getProviderTypes: publicProcedure.query(() => {
		return ProviderRegistry.getProviderTypes();
	}),

	/**
	 * Get details for a specific provider
	 */
	getProvider: publicProcedure
		.input(z.object({ type: providerTypeSchema }))
		.query(({ input }) => {
			const registration = ProviderRegistry.getRegistration(input.type);
			if (!registration) {
				return null;
			}
			return {
				type: registration.type,
				name: registration.name,
				description: registration.description,
				version: registration.version,
				capabilities: registration.capabilities,
			};
		}),

	/**
	 * Check if a provider is registered
	 */
	isRegistered: publicProcedure
		.input(z.object({ type: providerTypeSchema }))
		.query(({ input }) => {
			return ProviderRegistry.isRegistered(input.type);
		}),

	/**
	 * Get capability summary for all providers
	 */
	getCapabilitySummary: publicProcedure.query(() => {
		return ProviderRegistry.getCapabilitySummary();
	}),

	/**
	 * Find providers that support specific capabilities
	 */
	findProvidersWithCapabilities: publicProcedure
		.input(z.object({ capabilities: z.array(capabilitySchema) }))
		.query(({ input }) => {
			const registrations = ProviderRegistry.findProvidersWithCapabilities(
				input.capabilities as DbCapability[]
			);
			return registrations.map((reg) => ({
				type: reg.type,
				name: reg.name,
				description: reg.description,
				version: reg.version,
				capabilities: reg.capabilities,
			}));
		}),

	/**
	 * Check if a provider supports a specific capability
	 */
	hasCapability: publicProcedure
		.input(
			z.object({
				type: providerTypeSchema,
				capability: capabilitySchema,
			})
		)
		.query(({ input }) => {
			const registration = ProviderRegistry.getRegistration(input.type);
			if (!registration) {
				return false;
			}
			return registration.capabilities.includes(input.capability as DbCapability);
		}),

	/**
	 * Get all available capabilities (for UI documentation)
	 */
	getAllCapabilities: publicProcedure.query(() => {
		const allCapabilities: { capability: DbCapability; category: string; description: string }[] = [
			// Connection capabilities
			{ capability: "connection.test", category: "connection", description: "Test database connection" },
			{ capability: "connection.pool", category: "connection", description: "Connection pooling support" },
			// Metadata capabilities
			{ capability: "metadata.databases", category: "metadata", description: "List databases" },
			{ capability: "metadata.schemas", category: "metadata", description: "List schemas" },
			{ capability: "metadata.tables", category: "metadata", description: "List tables" },
			{ capability: "metadata.columns", category: "metadata", description: "Get column information" },
			{ capability: "metadata.indexes", category: "metadata", description: "Get index information" },
			{ capability: "metadata.constraints", category: "metadata", description: "Get constraint information" },
			{ capability: "metadata.tableStructure", category: "metadata", description: "Get complete table structure" },
			// Data capabilities
			{ capability: "data.select", category: "data", description: "Select/query rows" },
			{ capability: "data.insert", category: "data", description: "Insert rows" },
			{ capability: "data.update", category: "data", description: "Update rows" },
			{ capability: "data.delete", category: "data", description: "Delete rows" },
			{ capability: "data.rawQuery", category: "data", description: "Execute raw SQL queries" },
			// Transaction capabilities
			{ capability: "transaction.basic", category: "transaction", description: "Basic transaction support" },
			{ capability: "transaction.savepoints", category: "transaction", description: "Savepoint support" },
			{ capability: "transaction.isolation", category: "transaction", description: "Isolation level control" },
			// Feature capabilities
			{ capability: "feature.streaming", category: "feature", description: "Streaming query results" },
			{ capability: "feature.bulkOperations", category: "feature", description: "Bulk insert/update operations" },
			{ capability: "feature.explain", category: "feature", description: "Query execution plan analysis" },
			{ capability: "feature.notifications", category: "feature", description: "Real-time notifications/listen" },
		];
		return allCapabilities;
	}),
});

export type ProvidersRouter = typeof providersRouter;
