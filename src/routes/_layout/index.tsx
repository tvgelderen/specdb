import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { TableIcon, UnplugIcon } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useTableSelection } from "~/providers/table-selection-provider";
import { useActiveConnection } from "~/providers/connection-provider";
import { TableView, type TableRowData } from "~/components/table-view/table-view";
import type { TableColumn, TableViewState } from "~/components/table-view/types";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

export const Route = createFileRoute("/_layout/")({
	component: RouteComponent,
});

function RouteComponent() {
	const trpc = useTRPC();
	const { selectedTable } = useTableSelection();
	const { activeConnection, isLoading: isConnectionLoading } = useActiveConnection();

	// State for table view (must be before queries that use it)
	const [tableViewState, setTableViewState] = React.useState<TableViewState>({
		page: 1,
		pageSize: 25,
		sortColumn: null,
		sortDirection: null,
		filterColumn: null,
		filterValue: "",
		filters: [],
	});

	// Check for active connection
	const connectionQuery = useQuery(
		trpc.explorer.hasActiveConnection.queryOptions({})
	);

	// Fetch table data when a table is selected
	const tableDataQuery = useQuery({
		...trpc.explorer.getTableData.queryOptions({
			schema: selectedTable?.schema ?? "public",
			table: selectedTable?.table ?? "",
			database: selectedTable?.database,
			limit: tableViewState.pageSize,
			offset: (tableViewState.page - 1) * tableViewState.pageSize,
		}),
		enabled: !!selectedTable && !!connectionQuery.data?.hasConnection,
	});

	// Fetch table structure when a table is selected
	const tableStructureQuery = useQuery({
		...trpc.explorer.getTableStructure.queryOptions({
			schema: selectedTable?.schema ?? "public",
			table: selectedTable?.table ?? "",
			database: selectedTable?.database,
		}),
		enabled: !!selectedTable && !!connectionQuery.data?.hasConnection,
	});

	// Transform data for TableView - MUST be before early returns
	const columns: TableColumn[] = React.useMemo(() => {
		if (!tableStructureQuery.data?.columns) {
			// Fall back to columns from data query if structure isn't loaded yet
			return (
				tableDataQuery.data?.columns.map((col) => ({
					name: col.name,
					dataType: col.dataType,
					isNullable: true,
					isPrimaryKey: false,
					isForeignKey: false,
					defaultValue: null,
				})) ?? []
			);
		}

		return tableStructureQuery.data.columns.map((col) => ({
			name: col.name,
			dataType: col.dataType,
			isNullable: col.isNullable,
			isPrimaryKey: col.isPrimaryKey,
			isForeignKey: col.isForeignKey,
			defaultValue: col.defaultValue,
		}));
	}, [tableStructureQuery.data, tableDataQuery.data]);

	const rows: TableRowData[] = tableDataQuery.data?.rows ?? [];
	const totalRows = tableDataQuery.data?.totalRows ?? 0;

	// Handle refresh - MUST be before early returns
	const handleRefresh = React.useCallback(() => {
		tableDataQuery.refetch();
		tableStructureQuery.refetch();
	}, [tableDataQuery, tableStructureQuery]);

	// Loading state
	const isLoading = connectionQuery.isLoading || isConnectionLoading;

	// Show loading skeleton while checking connection
	if (isLoading) {
		return <LoadingSkeleton />;
	}

	// Show "no connection" empty state
	if (!connectionQuery.data?.hasConnection && !activeConnection) {
		return <NoConnectionEmptyState />;
	}

	// Show "no table selected" empty state
	if (!selectedTable) {
		return <NoTableSelectedEmptyState />;
	}

	return (
		<section className="h-full">
			<TableView
				tableInfo={{
					schema: selectedTable.schema,
					table: selectedTable.table,
					type: selectedTable.type,
				}}
				data={rows}
				columns={columns}
				totalRows={totalRows}
				loading={tableDataQuery.isLoading}
				headerLoading={tableDataQuery.isLoading}
				state={tableViewState}
				onStateChange={setTableViewState}
				onRefresh={handleRefresh}
				isRefreshing={tableDataQuery.isFetching}
				emptyMessage="This table has no data"
				structureColumns={tableStructureQuery.data?.columns}
				structureConstraints={tableStructureQuery.data?.constraints}
				structureIndexes={tableStructureQuery.data?.indexes}
				structureLoading={tableStructureQuery.isLoading}
				constraintsData={tableStructureQuery.data?.constraints}
				constraintsLoading={tableStructureQuery.isLoading}
				indexesData={tableStructureQuery.data?.indexes}
				indexesLoading={tableStructureQuery.isLoading}
				timing={tableDataQuery.data?.timing}
			/>
		</section>
	);
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton() {
	return (
		<div className="flex flex-col gap-4 p-6">
			<Skeleton className="h-8 w-64" />
			<Skeleton className="h-4 w-48" />
			<div className="flex gap-2 mt-4">
				<Skeleton className="h-10 w-24" />
				<Skeleton className="h-10 w-24" />
			</div>
			<Skeleton className="h-[400px] w-full mt-4" />
		</div>
	);
}

/**
 * Empty state when there's no active connection
 */
function NoConnectionEmptyState() {
	return (
		<div className="flex items-center justify-center h-full">
			<Empty className="border">
				<EmptyMedia variant="icon">
					<UnplugIcon className="size-5" />
				</EmptyMedia>
				<EmptyHeader>
					<EmptyTitle>No active connection</EmptyTitle>
					<EmptyDescription>
						Connect to a database to start exploring your data.
						Go to <strong>Connections</strong> to add or activate a connection.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}

/**
 * Empty state when no table is selected
 */
function NoTableSelectedEmptyState() {
	return (
		<div className="flex items-center justify-center h-full">
			<Empty className="border">
				<EmptyMedia variant="icon">
					<TableIcon className="size-5" />
				</EmptyMedia>
				<EmptyHeader>
					<EmptyTitle>No table selected</EmptyTitle>
					<EmptyDescription>
						Select a table from the explorer sidebar to view its data.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
