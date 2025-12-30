import * as React from "react";
import { createContext, useContext, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { toast } from "sonner";

/**
 * Connection type from the API (safe version without encrypted password)
 */
export interface Connection {
	id: number;
	name: string;
	providerType: string;
	host: string;
	port: number;
	database: string;
	username: string;
	sslConfig: { enabled: boolean; rejectUnauthorized?: boolean } | null;
	maxPoolSize: number | null;
	idleTimeoutMs: number | null;
	connectionTimeoutMs: number | null;
	isActive: boolean;
	color: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
	success: boolean;
	message: string;
	latencyMs: number;
}

/**
 * Connection context type
 */
interface ConnectionContextType {
	/** All saved connections */
	connections: Connection[];
	/** Currently active connection */
	activeConnection: Connection | null;
	/** Loading state for connections list */
	isLoading: boolean;
	/** Error state */
	error: unknown;
	/** Set a connection as active */
	setActiveConnection: (id: number) => Promise<void>;
	/** Clear the active connection */
	clearActiveConnection: () => Promise<void>;
	/** Delete a connection */
	deleteConnection: (id: number) => Promise<void>;
	/** Test a saved connection */
	testConnection: (id: number) => Promise<ConnectionTestResult>;
	/** Refresh the connections list */
	refetchConnections: () => void;
	/** Whether an operation is in progress */
	isOperationPending: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

interface ConnectionProviderProps {
	children: React.ReactNode;
}

export function ConnectionProvider({ children }: ConnectionProviderProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Fetch all connections
	const connectionsQuery = useQuery(trpc.connections.list.queryOptions());

	// Fetch active connection
	const activeConnectionQuery = useQuery(trpc.connections.getActive.queryOptions());

	// Set active connection mutation
	const setActiveMutation = useMutation(
		trpc.connections.setActive.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Connected to ${data.name}`);
				// Invalidate connection queries to refresh the state
				queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
				queryClient.invalidateQueries({ queryKey: trpc.connections.getActive.queryKey() });
				// Invalidate all explorer queries to refresh with new connection data
				queryClient.invalidateQueries({ queryKey: trpc.explorer.listDatabases.queryKey() });
				queryClient.invalidateQueries({ queryKey: trpc.explorer.listSchemas.queryKey() });
				queryClient.invalidateQueries({ queryKey: trpc.explorer.listTables.queryKey() });
			},
			onError: (error) => {
				toast.error(`Failed to connect: ${error.message}`);
			},
		}),
	);

	// Clear active connection mutation
	const clearActiveMutation = useMutation(
		trpc.connections.clearActive.mutationOptions({
			onSuccess: () => {
				toast.success("Disconnected");
				queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
				queryClient.invalidateQueries({ queryKey: trpc.connections.getActive.queryKey() });
				// Invalidate all explorer queries to clear the tree
				queryClient.invalidateQueries({ queryKey: trpc.explorer.listDatabases.queryKey() });
				queryClient.invalidateQueries({ queryKey: trpc.explorer.listSchemas.queryKey() });
				queryClient.invalidateQueries({ queryKey: trpc.explorer.listTables.queryKey() });
			},
			onError: (error) => {
				toast.error(`Failed to disconnect: ${error.message}`);
			},
		}),
	);

	// Delete connection mutation
	const deleteMutation = useMutation(
		trpc.connections.delete.mutationOptions({
			onSuccess: () => {
				toast.success("Connection deleted");
				queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
				queryClient.invalidateQueries({ queryKey: trpc.connections.getActive.queryKey() });
			},
			onError: (error) => {
				toast.error(`Failed to delete connection: ${error.message}`);
			},
		}),
	);

	// Test connection mutation
	const testMutation = useMutation(trpc.connections.testById.mutationOptions());

	// Callbacks
	const setActiveConnection = useCallback(
		async (id: number) => {
			await setActiveMutation.mutateAsync({ id });
		},
		[setActiveMutation],
	);

	const clearActiveConnection = useCallback(async () => {
		await clearActiveMutation.mutateAsync();
	}, [clearActiveMutation]);

	const deleteConnection = useCallback(
		async (id: number) => {
			await deleteMutation.mutateAsync({ id });
		},
		[deleteMutation],
	);

	const testConnection = useCallback(
		async (id: number): Promise<ConnectionTestResult> => {
			return await testMutation.mutateAsync({ id });
		},
		[testMutation],
	);

	const refetchConnections = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
		queryClient.invalidateQueries({ queryKey: trpc.connections.getActive.queryKey() });
	}, [queryClient, trpc.connections.list, trpc.connections.getActive]);

	const value: ConnectionContextType = {
		connections: connectionsQuery.data ?? [],
		activeConnection: activeConnectionQuery.data ?? null,
		isLoading: connectionsQuery.isLoading || activeConnectionQuery.isLoading,
		error: connectionsQuery.error || activeConnectionQuery.error || null,
		setActiveConnection,
		clearActiveConnection,
		deleteConnection,
		testConnection,
		refetchConnections,
		isOperationPending:
			setActiveMutation.isPending ||
			clearActiveMutation.isPending ||
			deleteMutation.isPending ||
			testMutation.isPending,
	};

	return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

/**
 * Hook to access connection context
 */
export function useConnection() {
	const context = useContext(ConnectionContext);
	if (context === undefined) {
		throw new Error("useConnection must be used within a ConnectionProvider");
	}
	return context;
}

/**
 * Hook to get only the active connection
 */
export function useActiveConnection() {
	const { activeConnection, isLoading } = useConnection();
	return { activeConnection, isLoading };
}
