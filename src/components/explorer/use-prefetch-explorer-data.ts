import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import type { ExplorerDatabaseInfo, ExplorerSchemaInfo } from "~/trpc/explorer/types";

/**
 * Hook to prefetch explorer data for instant loading
 *
 * This hook prefetches:
 * 1. Schemas for all databases when the databases list loads
 * 2. Tables for all schemas when a specific database's schemas load
 *
 * This eliminates the loading flicker when expanding database and schema nodes.
 */
export function usePrefetchExplorerData(connectionId?: string) {
	const queryClient = useQueryClient();
	const trpc = useTRPC();

	/**
	 * Prefetch schemas for all provided databases
	 * Called when the databases list is loaded
	 */
	const prefetchSchemasForDatabases = React.useCallback(
		async (databases: ExplorerDatabaseInfo[]) => {
			// Prefetch schemas for each database in parallel
			const prefetchPromises = databases.map((database) =>
				queryClient.prefetchQuery(
					trpc.explorer.listSchemas.queryOptions({
						connectionId,
						database: database.name,
					})
				)
			);

			// Run all prefetches in parallel (don't await to avoid blocking)
			Promise.all(prefetchPromises).catch((error) => {
				// Silently ignore prefetch errors - they'll be shown when user expands the node
				console.debug("[Prefetch] Failed to prefetch schemas:", error);
			});
		},
		[queryClient, trpc.explorer.listSchemas, connectionId]
	);

	/**
	 * Prefetch tables for all schemas in a database
	 * Called when a database is expanded and its schemas are loaded
	 */
	const prefetchTablesForSchemas = React.useCallback(
		async (schemas: ExplorerSchemaInfo[]) => {
			// Prefetch tables for each schema in parallel
			const prefetchPromises = schemas.map((schema) =>
				queryClient.prefetchQuery(
					trpc.explorer.listTables.queryOptions({
						connectionId,
						database: schema.database,
						schema: schema.name,
					})
				)
			);

			// Run all prefetches in parallel (don't await to avoid blocking)
			Promise.all(prefetchPromises).catch((error) => {
				// Silently ignore prefetch errors - they'll be shown when user expands the node
				console.debug("[Prefetch] Failed to prefetch tables:", error);
			});
		},
		[queryClient, trpc.explorer.listTables, connectionId]
	);

	return {
		prefetchSchemasForDatabases,
		prefetchTablesForSchemas,
	};
}
