import * as React from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Header } from "~/components/header";
import { ExplorerSidebar, useExplorerSidebar } from "~/components/explorer";
import { CreateDatabaseDialog } from "~/components/explorer/create-database-dialog";
import { useTableSelection } from "~/providers/table-selection-provider";
import { useTRPC } from "~/trpc/react";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_layout")({
	component: RouteComponent,
});

function RouteComponent() {
	const queryClient = useQueryClient();
	const trpc = useTRPC();
	const navigate = useNavigate();
	const { setSelectedTable } = useTableSelection();
	const {
		isCollapsed,
		isMobileOpen,
		toggleCollapse,
		toggleMobile,
		closeMobile,
		selectedNodeId,
		setSelectedNodeId,
		// Resize functionality
		width,
		isResizing,
		resizeHandleProps,
	} = useExplorerSidebar();

	// Create database dialog state
	const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

	// Check if there's an active connection
	const activeConnectionQuery = useQuery(
		trpc.explorer.hasActiveConnection.queryOptions({})
	);
	const hasActiveConnection = activeConnectionQuery.data?.hasConnection ?? false;
	const activeProviderType = activeConnectionQuery.data?.providerType ?? null;

	// SQLite doesn't support creating databases through the UI
	const canCreateDatabase = hasActiveConnection && activeProviderType !== "sqlite";

	// Create database mutation
	const createDatabaseMutation = useMutation(
		trpc.explorer.createDatabase.mutationOptions({
			onSuccess: (data) => {
				toast.success(`Database "${data.databaseName}" created successfully`);
				setCreateDialogOpen(false);
				// Invalidate the databases query to refresh the list
				queryClient.invalidateQueries({
					queryKey: trpc.explorer.listDatabases.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`Failed to create database: ${error.message}`);
			},
		})
	);

	// Handle create database
	const handleCreateDatabase = React.useCallback(
		(databaseName: string) => {
			createDatabaseMutation.mutate({ databaseName });
		},
		[createDatabaseMutation]
	);

	// Handle node selection
	const handleNodeSelect = React.useCallback(
		(node: {
			type: "database" | "schema" | "table" | "view" | "materialized_view";
			database?: string;
			schema?: string;
			table?: string;
		}) => {
			// Build node ID for selection tracking
			let nodeId: string;
			if (node.type === "database") {
				nodeId = `database:${node.database}`;
			} else if (node.type === "schema") {
				nodeId = `schema:${node.database}:${node.schema}`;
			} else {
				nodeId = `${node.type}:${node.schema}:${node.table}`;
			}
			setSelectedNodeId(nodeId);

			// Close mobile sidebar after selection
			closeMobile();

			// If a table, view, or materialized view is selected, update the table selection
			// and navigate to the index page to show the table view
			if (
				(node.type === "table" || node.type === "view" || node.type === "materialized_view") &&
				node.schema &&
				node.table
			) {
				setSelectedTable({
					type: node.type,
					database: node.database,
					schema: node.schema,
					table: node.table,
				});
				// Navigate to the index page to show the table view
				navigate({ to: "/" });
			}
		},
		[setSelectedNodeId, closeMobile, setSelectedTable, navigate]
	);

	// Handle refresh
	const handleRefresh = React.useCallback(() => {
		// Invalidate specific explorer queries using proper TRPC query keys to refetch fresh data
		queryClient.invalidateQueries({
			queryKey: trpc.explorer.listDatabases.queryKey(),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.explorer.listSchemas.queryKey(),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.explorer.listTables.queryKey(),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.explorer.hasActiveConnection.queryKey(),
		});
	}, [queryClient, trpc.explorer.listDatabases, trpc.explorer.listSchemas, trpc.explorer.listTables, trpc.explorer.hasActiveConnection]);

	// Handle keyboard shortcut for sidebar toggle
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl/Cmd + B to toggle sidebar
			if ((e.ctrlKey || e.metaKey) && e.key === "b") {
				e.preventDefault();
				toggleCollapse();
			}
			// Escape to close mobile sidebar
			if (e.key === "Escape" && isMobileOpen) {
				closeMobile();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleCollapse, isMobileOpen, closeMobile]);

	return (
		<div className="flex flex-col h-screen">
			<Header onMenuClick={toggleMobile} />
			<div className="flex flex-1 overflow-hidden relative">
				{/* Mobile overlay backdrop */}
				{isMobileOpen && (
					<div
						className="fixed inset-0 bg-black/50 z-40 md:hidden"
						onClick={closeMobile}
						aria-hidden="true"
					/>
				)}

				{/* Sidebar - responsive behavior with resize handle */}
				<ExplorerSidebar
					onNodeSelect={handleNodeSelect}
					selectedNodeId={selectedNodeId}
					isCollapsed={isCollapsed}
					isMobileOpen={isMobileOpen}
					onToggleCollapse={toggleCollapse}
					onCloseMobile={closeMobile}
					onRefresh={handleRefresh}
					onCreateDatabase={canCreateDatabase ? () => setCreateDialogOpen(true) : undefined}
					hasActiveConnection={hasActiveConnection}
					providerType={activeProviderType}
					width={isMobileOpen ? undefined : width}
					isResizing={isResizing}
					resizeHandleProps={isMobileOpen ? undefined : resizeHandleProps}
					className={cn(
						// Mobile: fixed overlay
						"fixed md:relative z-50 md:z-auto",
						"transform transition-transform duration-200 ease-in-out md:transform-none",
						isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
					)}
				/>

				<main className="flex-1 overflow-auto p-4 md:p-6">
					<Outlet />
				</main>
			</div>

			{/* Create Database Dialog */}
			<CreateDatabaseDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onConfirm={handleCreateDatabase}
				isCreating={createDatabaseMutation.isPending}
			/>
		</div>
	);
}
