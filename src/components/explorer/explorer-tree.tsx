import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";
import { useLocalStorageSet } from "~/lib/hooks";
import {
	TreeNode,
	TreeNodeSkeleton,
	TreeNodeError,
	TreeNodeEmpty,
	TreeLoadMore,
} from "./tree-node";
import { usePrefetchExplorerData } from "./use-prefetch-explorer-data";
import { DatabaseContextMenu } from "./database-context-menu";
import { RenameDatabaseDialog } from "./rename-database-dialog";
import { DeleteDatabaseDialog } from "./delete-database-dialog";
import { CloneDatabaseDialog } from "./clone-database-dialog";
import type {
	ExplorerDatabaseInfo,
	ExplorerSchemaInfo,
	ExplorerTableInfo,
	PaginatedExplorerResponse,
} from "~/trpc/explorer/types";

/** localStorage key for expanded nodes persistence */
const EXPANDED_NODES_STORAGE_KEY = "explorer-tree-expanded-nodes";

/**
 * Permission error codes that indicate access is restricted
 */
const PERMISSION_ERROR_CODES = ["FORBIDDEN", "UNAUTHORIZED"];

/**
 * Check if an error is a permission error
 */
function isPermissionError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const err = error as { code?: string; message?: string };
	return Boolean(
		PERMISSION_ERROR_CODES.includes(err.code ?? "") ||
		err.message?.toLowerCase().includes("permission") ||
		err.message?.toLowerCase().includes("unauthorized") ||
		err.message?.toLowerCase().includes("forbidden")
	);
}

/**
 * Get a user-friendly error message
 */
function getErrorMessage(error: unknown, context: string): string {
	if (isPermissionError(error)) {
		return `Permission denied to view ${context}`;
	}
	if (error && typeof error === "object" && "message" in error) {
		return String((error as { message: string }).message);
	}
	return `Failed to load ${context}`;
}

/**
 * Props for ExplorerTree component
 */
export interface ExplorerTreeProps {
	/** Optional connection ID for multi-connection support */
	connectionId?: string;
	/** Callback when a node is selected */
	onNodeSelect?: (node: {
		type: "database" | "schema" | "table" | "view" | "materialized_view";
		database?: string;
		schema?: string;
		table?: string;
	}) => void;
	/** Currently selected node ID */
	selectedNodeId?: string;
	/** The provider type of the active connection (e.g., 'sqlite', 'postgres') */
	providerType?: string | null;
}

/**
 * ExplorerTree - Hierarchical tree view for databases, schemas, and tables
 * Features lazy loading, skeleton loaders, and graceful permission error handling
 */
export function ExplorerTree({
	connectionId,
	onNodeSelect,
	selectedNodeId,
	providerType,
}: ExplorerTreeProps) {
	const trpc = useTRPC();

	// Prefetch hook for eager loading of schemas and tables
	const { prefetchSchemasForDatabases, prefetchTablesForSchemas } =
		usePrefetchExplorerData(connectionId);

	// Track expanded nodes - persisted to localStorage
	const [expandedNodes, setExpandedNodes] = useLocalStorageSet<string>(
		EXPANDED_NODES_STORAGE_KEY,
		new Set()
	);

	// Toggle node expansion
	const toggleNode = React.useCallback((nodeId: string) => {
		setExpandedNodes((prev) => {
			const next = new Set(prev);
			if (next.has(nodeId)) {
				next.delete(nodeId);
			} else {
				next.add(nodeId);
			}
			return next;
		});
	}, [setExpandedNodes]);

	// Fetch databases
	const databasesQuery = useQuery(
		trpc.explorer.listDatabases.queryOptions({
			connectionId,
		})
	);

	const databases = databasesQuery.data?.items ?? [];
	const isDatabasesLoading = databasesQuery.isLoading;
	const databasesError = databasesQuery.error;

	// Prefetch schemas for all databases when the database list loads
	React.useEffect(() => {
		if (databases.length > 0 && !isDatabasesLoading && !databasesError) {
			prefetchSchemasForDatabases(databases);
		}
	}, [databases, isDatabasesLoading, databasesError, prefetchSchemasForDatabases]);

	// Handle permission-based graceful degradation for databases
	if (databasesError && isPermissionError(databasesError)) {
		return (
			<div className="p-4">
				<PermissionDeniedMessage
					title="Database access restricted"
					description="You don't have permission to view databases. Please contact your administrator for access."
				/>
			</div>
		);
	}

	return (
		<div
			role="tree"
			aria-label="Database Explorer"
			className="py-2"
		>
			{/* Loading state */}
			{isDatabasesLoading && <TreeNodeSkeleton count={3} depth={0} />}

			{/* Error state */}
			{databasesError && !isPermissionError(databasesError) && (
				<TreeNodeError
					message={getErrorMessage(databasesError, "databases")}
					depth={0}
					onRetry={() => databasesQuery.refetch()}
				/>
			)}

			{/* Empty state */}
			{!isDatabasesLoading && !databasesError && databases.length === 0 && (
				<TreeNodeEmpty message="No databases found" depth={0} />
			)}

			{/* Database nodes */}
			{databases.map((database) => (
				<DatabaseNode
					key={database.treeMeta.id}
					database={database}
					connectionId={connectionId}
					isExpanded={expandedNodes.has(database.treeMeta.id)}
					isSelected={selectedNodeId === database.treeMeta.id}
					onToggle={() => toggleNode(database.treeMeta.id)}
					onSelect={() =>
						onNodeSelect?.({
							type: "database",
							database: database.name,
						})
					}
					onNodeSelect={onNodeSelect}
					selectedNodeId={selectedNodeId}
					expandedNodes={expandedNodes}
					toggleNode={toggleNode}
					prefetchTablesForSchemas={prefetchTablesForSchemas}
					providerType={providerType}
				/>
			))}

			{/* Load more databases */}
			{databasesQuery.data?.pagination.hasMore && (
				<TreeLoadMore
					remaining={
						databasesQuery.data.pagination.total -
						databasesQuery.data.pagination.offset -
						databases.length
					}
					depth={0}
					isLoading={false}
					onLoadMore={() => {
						// TODO: Implement pagination loading
						console.log("Load more databases");
					}}
				/>
			)}
		</div>
	);
}

/**
 * DatabaseNode - A database node with lazy-loaded schemas
 */
interface DatabaseNodeProps {
	database: ExplorerDatabaseInfo;
	connectionId?: string;
	isExpanded: boolean;
	isSelected: boolean;
	onToggle: () => void;
	onSelect: () => void;
	onNodeSelect?: ExplorerTreeProps["onNodeSelect"];
	selectedNodeId?: string;
	expandedNodes: Set<string>;
	toggleNode: (nodeId: string) => void;
	/** Callback to prefetch tables for all schemas when schemas load */
	prefetchTablesForSchemas: (schemas: ExplorerSchemaInfo[]) => void;
	/** The provider type of the active connection (e.g., 'sqlite', 'postgres') */
	providerType?: string | null;
}

function DatabaseNode({
	database,
	connectionId,
	isExpanded,
	isSelected,
	onToggle,
	onSelect,
	onNodeSelect,
	selectedNodeId,
	expandedNodes,
	toggleNode,
	prefetchTablesForSchemas,
	providerType,
}: DatabaseNodeProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Dialog states
	const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
	const [cloneDialogOpen, setCloneDialogOpen] = React.useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

	// Query for active connections - enabled when dialogs are open
	const connectionsQuery = useQuery({
		...trpc.explorer.getDatabaseConnections.queryOptions({
			connectionId,
			databaseName: database.name,
		}),
		enabled: renameDialogOpen || cloneDialogOpen || deleteDialogOpen,
		// Refetch every 5 seconds while dialog is open to keep connection info fresh
		refetchInterval: (renameDialogOpen || cloneDialogOpen || deleteDialogOpen) ? 5000 : false,
	});

	// Lazy load schemas only when expanded
	const schemasQuery = useQuery({
		...trpc.explorer.listSchemas.queryOptions({
			connectionId,
			database: database.name,
		}),
		enabled: isExpanded,
	});

	const schemas = schemasQuery.data?.items ?? [];
	const isSchemasLoading = schemasQuery.isLoading && isExpanded;
	const schemasError = schemasQuery.error;

	// Rename database mutation
	const renameMutation = useMutation(
		trpc.explorer.renameDatabase.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Database renamed to "${data.newName}"`);
				setRenameDialogOpen(false);
				// Invalidate the databases query to refresh the list
				queryClient.invalidateQueries({
					queryKey: trpc.explorer.listDatabases.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`Failed to rename database: ${error.message}`);
			},
		})
	);

	// Delete database mutation
	const deleteMutation = useMutation(
		trpc.explorer.deleteDatabase.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Database "${data.databaseName}" deleted`);
				setDeleteDialogOpen(false);
				// Invalidate the databases query to refresh the list
				queryClient.invalidateQueries({
					queryKey: trpc.explorer.listDatabases.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`Failed to delete database: ${error.message}`);
			},
		})
	);

	// Clone database mutation
	const cloneMutation = useMutation(
		trpc.explorer.cloneDatabase.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Database cloned to "${data.targetDatabaseName}"`);
				setCloneDialogOpen(false);
				queryClient.invalidateQueries({
					queryKey: trpc.explorer.listDatabases.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`Failed to clone database: ${error.message}`);
			},
		})
	);

	// Handle rename confirm
	const handleRenameConfirm = React.useCallback(
		(newName: string, force: boolean) => {
			renameMutation.mutate({
				connectionId,
				oldName: database.name,
				newName,
				force,
			});
		},
		[renameMutation, connectionId, database.name]
	);

	// Handle delete confirm
	const handleDeleteConfirm = React.useCallback(
		(force: boolean) => {
			deleteMutation.mutate({
				connectionId,
				databaseName: database.name,
				force,
			});
		},
		[deleteMutation, connectionId, database.name]
	);

	// Handle clone confirm
	const handleCloneConfirm = React.useCallback(
		(targetName: string, force: boolean) => {
			cloneMutation.mutate({
				connectionId,
				sourceDatabaseName: database.name,
				targetDatabaseName: targetName,
				force,
			});
		},
		[cloneMutation, connectionId, database.name]
	);

	// Prefetch tables for all schemas when schemas are loaded
	// This is triggered when the database is expanded and schemas are fetched
	React.useEffect(() => {
		if (schemas.length > 0 && !isSchemasLoading && !schemasError) {
			prefetchTablesForSchemas(schemas);
		}
	}, [schemas, isSchemasLoading, schemasError, prefetchTablesForSchemas]);

	return (
		<>
			<TreeNode
				id={database.treeMeta.id}
				label={database.name}
				treeMeta={database.treeMeta}
				depth={0}
				isExpanded={isExpanded}
				isSelected={isSelected}
				isLoading={isSchemasLoading}
				hasError={!!schemasError && !isPermissionError(schemasError)}
				onToggle={onToggle}
				onSelect={onSelect}
				actions={
					// SQLite doesn't support rename/clone/delete database operations
					providerType !== "sqlite" ? (
						<DatabaseContextMenu
							databaseName={database.name}
							onRename={() => setRenameDialogOpen(true)}
							onClone={() => setCloneDialogOpen(true)}
							onDelete={() => setDeleteDialogOpen(true)}
						/>
					) : undefined
				}
			>
				{/* Loading state */}
				{isSchemasLoading && <TreeNodeSkeleton count={3} depth={1} />}

				{/* Permission error - graceful degradation */}
				{schemasError && isPermissionError(schemasError) && (
					<PermissionDeniedNode
						message="Permission denied to view schemas"
						depth={1}
					/>
				)}

				{/* Other errors */}
				{schemasError && !isPermissionError(schemasError) && (
					<TreeNodeError
						message={getErrorMessage(schemasError, "schemas")}
						depth={1}
						onRetry={() => schemasQuery.refetch()}
					/>
				)}

				{/* Empty state */}
				{!isSchemasLoading && !schemasError && schemas.length === 0 && isExpanded && (
					<TreeNodeEmpty message="No schemas" depth={1} />
				)}

				{/* Schema nodes */}
				{schemas.map((schema) => (
					<SchemaNode
						key={schema.treeMeta.id}
						schema={schema}
						connectionId={connectionId}
						isExpanded={expandedNodes.has(schema.treeMeta.id)}
						isSelected={selectedNodeId === schema.treeMeta.id}
						onToggle={() => toggleNode(schema.treeMeta.id)}
						onSelect={() =>
							onNodeSelect?.({
								type: "schema",
								database: database.name,
								schema: schema.name,
							})
						}
						onNodeSelect={onNodeSelect}
						selectedNodeId={selectedNodeId}
					/>
				))}

				{/* Load more schemas */}
				{schemasQuery.data?.pagination.hasMore && (
					<TreeLoadMore
						remaining={
							schemasQuery.data.pagination.total -
							schemasQuery.data.pagination.offset -
							schemas.length
						}
						depth={1}
						isLoading={false}
						onLoadMore={() => {
							// TODO: Implement pagination loading
							console.log("Load more schemas");
						}}
					/>
				)}
			</TreeNode>

			{/* Rename Database Dialog */}
			<RenameDatabaseDialog
				open={renameDialogOpen}
				onOpenChange={setRenameDialogOpen}
				databaseName={database.name}
				onConfirm={handleRenameConfirm}
				isRenaming={renameMutation.isPending}
				isCheckingConnections={connectionsQuery.isLoading}
				activeConnectionCount={connectionsQuery.data?.count ?? 0}
				activeConnections={connectionsQuery.data?.connections ?? []}
			/>

			{/* Clone Database Dialog */}
			<CloneDatabaseDialog
				open={cloneDialogOpen}
				onOpenChange={setCloneDialogOpen}
				sourceDatabaseName={database.name}
				onConfirm={handleCloneConfirm}
				isCloning={cloneMutation.isPending}
				isCheckingConnections={connectionsQuery.isLoading}
				activeConnectionCount={connectionsQuery.data?.count ?? 0}
				activeConnections={connectionsQuery.data?.connections ?? []}
			/>

			{/* Delete Database Dialog */}
			<DeleteDatabaseDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				databaseName={database.name}
				onConfirm={handleDeleteConfirm}
				isDeleting={deleteMutation.isPending}
				isCheckingConnections={connectionsQuery.isLoading}
				activeConnectionCount={connectionsQuery.data?.count ?? 0}
				activeConnections={connectionsQuery.data?.connections ?? []}
			/>
		</>
	);
}

/**
 * SchemaNode - A schema node with lazy-loaded tables
 */
interface SchemaNodeProps {
	schema: ExplorerSchemaInfo;
	connectionId?: string;
	isExpanded: boolean;
	isSelected: boolean;
	onToggle: () => void;
	onSelect: () => void;
	onNodeSelect?: ExplorerTreeProps["onNodeSelect"];
	selectedNodeId?: string;
}

function SchemaNode({
	schema,
	connectionId,
	isExpanded,
	isSelected,
	onToggle,
	onSelect,
	onNodeSelect,
	selectedNodeId,
}: SchemaNodeProps) {
	const trpc = useTRPC();

	// Lazy load tables only when expanded
	const tablesQuery = useQuery({
		...trpc.explorer.listTables.queryOptions({
			connectionId,
			database: schema.database,
			schema: schema.name,
		}),
		enabled: isExpanded,
	});

	const tables = tablesQuery.data?.items ?? [];
	const isTablesLoading = tablesQuery.isLoading && isExpanded;
	const tablesError = tablesQuery.error;

	return (
		<TreeNode
			id={schema.treeMeta.id}
			label={schema.name}
			treeMeta={schema.treeMeta}
			depth={1}
			isExpanded={isExpanded}
			isSelected={isSelected}
			isLoading={isTablesLoading}
			hasError={!!tablesError && !isPermissionError(tablesError)}
			onToggle={onToggle}
			onSelect={onSelect}
		>
			{/* Loading state */}
			{isTablesLoading && <TreeNodeSkeleton count={5} depth={2} />}

			{/* Permission error - graceful degradation */}
			{tablesError && isPermissionError(tablesError) && (
				<PermissionDeniedNode
					message="Permission denied to view tables"
					depth={2}
				/>
			)}

			{/* Other errors */}
			{tablesError && !isPermissionError(tablesError) && (
				<TreeNodeError
					message={getErrorMessage(tablesError, "tables")}
					depth={2}
					onRetry={() => tablesQuery.refetch()}
				/>
			)}

			{/* Empty state */}
			{!isTablesLoading && !tablesError && tables.length === 0 && isExpanded && (
				<TreeNodeEmpty message="No tables" depth={2} />
			)}

			{/* Table nodes */}
			{tables.map((table) => (
				<TreeNode
					key={table.treeMeta.id}
					id={table.treeMeta.id}
					label={table.name}
					treeMeta={table.treeMeta}
					depth={2}
					isExpanded={false}
					isSelected={selectedNodeId === table.treeMeta.id}
					onSelect={() =>
						onNodeSelect?.({
							type: table.type,
							database: schema.database,
							schema: schema.name,
							table: table.name,
						})
					}
				/>
			))}

			{/* Load more tables */}
			{tablesQuery.data?.pagination.hasMore && (
				<TreeLoadMore
					remaining={
						tablesQuery.data.pagination.total -
						tablesQuery.data.pagination.offset -
						tables.length
					}
					depth={2}
					isLoading={false}
					onLoadMore={() => {
						// TODO: Implement pagination loading
						console.log("Load more tables");
					}}
				/>
			)}
		</TreeNode>
	);
}

/**
 * PermissionDeniedMessage - Full-page permission denied state
 */
interface PermissionDeniedMessageProps {
	title: string;
	description: string;
}

function PermissionDeniedMessage({ title, description }: PermissionDeniedMessageProps) {
	return (
		<div className="flex flex-col items-center justify-center text-center py-8 px-4 text-muted-foreground">
			<div className="rounded-full bg-muted p-3 mb-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="size-6"
				>
					<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
					<path d="M7 11V7a5 5 0 0 1 10 0v4" />
				</svg>
			</div>
			<h3 className="font-medium text-foreground mb-1">{title}</h3>
			<p className="text-sm">{description}</p>
		</div>
	);
}

/**
 * PermissionDeniedNode - Inline permission denied indicator
 */
interface PermissionDeniedNodeProps {
	message: string;
	depth: number;
}

function PermissionDeniedNode({ message, depth }: PermissionDeniedNodeProps) {
	return (
		<div
			className="flex items-center gap-2 h-8 pr-2 text-sm text-muted-foreground"
			style={{ paddingLeft: `${depth * 16 + 8}px` }}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="size-4 shrink-0"
			>
				<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
			<span className="truncate italic">{message}</span>
		</div>
	);
}
