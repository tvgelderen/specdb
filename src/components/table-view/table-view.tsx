import * as React from "react";
import { TableIcon, ColumnsIcon, ShieldCheckIcon, DatabaseIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import {
	DataGrid,
	DataGridToolbar,
	DataGridTable,
	DataGridSkeleton,
	DataGridPagination,
	type ColumnDef,
	type DataGridState,
} from "~/components/ui/data-grid";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "~/components/ui/empty";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { CellDataViewer, shouldShowViewer } from "~/components/ui/cell-data-viewer";
import { TableViewHeader, TableViewHeaderSkeleton } from "./table-view-header";
import {
	TableStructureView,
	TableStructureViewSkeleton,
	type StructureColumnInfo,
	type StructureConstraintInfo,
	type StructureIndexInfo,
} from "./table-structure-view";
import { TableConstraintsView, TableConstraintsViewSkeleton, type ConstraintInfo } from "./table-constraints-view";
import { TableIndexesView, TableIndexesViewSkeleton, type IndexViewInfo } from "./table-indexes-view";
import { useTableViewState } from "./use-table-view-state";
import type { TableIdentifier, TableViewState, TableColumn } from "./types";
import type { TimingMetrics } from "~/components/ui/timing-badge";

// ============================================================================
// Types
// ============================================================================

/**
 * Row data type - generic record with string keys
 */
export type TableRowData = Record<string, unknown>;

/**
 * Active tab in the table view
 */
export type TableViewTab = "data" | "structure" | "constraints" | "indexes";

/**
 * Props for TableView component
 */
export interface TableViewProps<T extends TableRowData = TableRowData> {
	/** Table identification (schema, table name, type) */
	tableInfo: TableIdentifier;
	/** Table data (rows) */
	data: T[];
	/** Column definitions from database schema */
	columns: TableColumn[];
	/** Total row count in the table (may be approximate) */
	totalRows?: number | null;
	/** Whether the total row count is an estimate */
	isRowCountEstimate?: boolean;
	/** Whether data is currently loading */
	loading?: boolean;
	/** Whether the header info is loading */
	headerLoading?: boolean;
	/** External state for controlled mode */
	state?: TableViewState;
	/** Callback when state changes */
	onStateChange?: (state: TableViewState) => void;
	/** Callback when refresh is requested */
	onRefresh?: () => void;
	/** Whether a refresh is in progress */
	isRefreshing?: boolean;
	/** Custom empty message */
	emptyMessage?: string;
	/** Additional CSS classes */
	className?: string;
	/** Extended column metadata for structure view (from pg_catalog) */
	structureColumns?: StructureColumnInfo[];
	/** Constraint metadata for structure view */
	structureConstraints?: StructureConstraintInfo[];
	/** Index metadata for structure view */
	structureIndexes?: StructureIndexInfo[];
	/** Whether structure data is loading */
	structureLoading?: boolean;
	/** Constraint metadata for constraints view (dedicated tab) */
	constraintsData?: ConstraintInfo[];
	/** Whether constraints data is loading */
	constraintsLoading?: boolean;
	/** Index metadata for indexes view (dedicated tab) */
	indexesData?: IndexViewInfo[];
	/** Whether indexes data is loading */
	indexesLoading?: boolean;
	/** Currently active tab */
	activeTab?: TableViewTab;
	/** Callback when tab changes */
	onTabChange?: (tab: TableViewTab) => void;
	/** Query timing metrics (optional) */
	timing?: TimingMetrics | null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert database columns to DataGrid column definitions
 */
function columnsToDataGridDefs<T extends TableRowData>(columns: TableColumn[]): ColumnDef<T>[] {
	return columns.map((col) => ({
		id: col.name,
		header: col.name,
		accessorKey: col.name as keyof T,
		sortable: true,
		filterable: true,
		cell: (value: T[keyof T]) => formatCellValue(value, col.dataType, col.name),
	}));
}

/** Maximum character length before showing the data viewer */
const MAX_INLINE_LENGTH = 50;

/**
 * Format cell value based on data type
 */
function formatCellValue(value: unknown, dataType: string, columnName?: string): React.ReactNode {
	if (value === null) {
		return <span className="text-muted-foreground italic text-xs">NULL</span>;
	}

	if (value === undefined) {
		return <span className="text-muted-foreground text-xs">-</span>;
	}

	// Handle boolean values
	if (typeof value === "boolean") {
		return (
			<span
				className={cn(
					"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
					value ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
				)}
			>
				{value ? "true" : "false"}
			</span>
		);
	}

	// Handle dates
	if (value instanceof Date) {
		return <span className="whitespace-nowrap text-xs">{formatDate(value, dataType)}</span>;
	}

	// Handle date strings
	if (
		typeof value === "string" &&
		(dataType.includes("timestamp") || dataType.includes("date") || dataType === "time")
	) {
		const date = new Date(value);
		if (!isNaN(date.getTime())) {
			return <span className="whitespace-nowrap text-xs">{formatDate(date, dataType)}</span>;
		}
	}

	// Handle arrays - use CellDataViewer for expandable view
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return <span className="text-muted-foreground text-xs font-mono">[]</span>;
		}
		return <CellDataViewer value={value} dataType="array" maxLength={MAX_INLINE_LENGTH} columnName={columnName} />;
	}

	// Handle JSON/objects - use CellDataViewer for expandable view
	if (typeof value === "object" && value !== null) {
		if (Object.keys(value).length === 0) {
			return <span className="text-muted-foreground text-xs font-mono">{"{}"}</span>;
		}
		return <CellDataViewer value={value} dataType="json" maxLength={MAX_INLINE_LENGTH} columnName={columnName} />;
	}

	// Handle numbers
	if (typeof value === "number") {
		const formatted = Math.abs(value) >= 1000 ? new Intl.NumberFormat().format(value) : String(value);
		return <span className="whitespace-nowrap text-xs tabular-nums">{formatted}</span>;
	}

	// Handle strings - use CellDataViewer for long strings
	const strValue = String(value);
	if (shouldShowViewer(strValue, MAX_INLINE_LENGTH)) {
		return (
			<CellDataViewer value={strValue} dataType="string" maxLength={MAX_INLINE_LENGTH} columnName={columnName} />
		);
	}

	// Short strings - render inline with single line
	return <span className="whitespace-nowrap text-xs">{strValue}</span>;
}

/**
 * Format a date value
 */
function formatDate(date: Date, dataType: string): string {
	if (dataType === "time" || dataType.includes("time without")) {
		return date.toLocaleTimeString("en-US", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	if (dataType === "date") {
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	// timestamp or timestamptz
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

/**
 * Convert TableViewState to DataGridState
 */
function toDataGridState(state: TableViewState): DataGridState {
	return {
		page: state.page,
		pageSize: state.pageSize,
		sortColumn: state.sortColumn,
		sortDirection: state.sortDirection,
		filterColumn: state.filterColumn,
		filterValue: state.filterValue,
	};
}

/**
 * Convert DataGridState to TableViewState updates
 */
function fromDataGridState(gridState: DataGridState, prevState: TableViewState): TableViewState {
	return {
		...prevState,
		page: gridState.page,
		pageSize: gridState.pageSize,
		sortColumn: gridState.sortColumn,
		sortDirection: gridState.sortDirection,
		filterColumn: gridState.filterColumn,
		filterValue: gridState.filterValue,
	};
}

// ============================================================================
// Context
// ============================================================================

interface TableViewContextValue {
	tableInfo: TableIdentifier;
	columns: TableColumn[];
	totalRows: number | null;
	isRowCountEstimate: boolean;
}

const TableViewContext = React.createContext<TableViewContextValue | null>(null);

/**
 * Hook to access table view context
 */
export function useTableViewContext() {
	const context = React.useContext(TableViewContext);
	if (!context) {
		throw new Error("TableView components must be used within a TableView");
	}
	return context;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TableView - A complete table viewing component for database tables
 *
 * Features:
 * - Schema.table header with type icon
 * - Row count display
 * - Tabbed interface for Data and Structure views
 * - Data grid with sorting and filtering
 * - Structure view with column metadata, constraints, and indexes
 * - Pagination controls
 * - Query limit enforcement message
 * - Loading states
 *
 * @example
 * ```tsx
 * <TableView
 *   tableInfo={{ schema: "public", table: "users", type: "table" }}
 *   data={rows}
 *   columns={columns}
 *   totalRows={1500}
 *   loading={isLoading}
 *   structureColumns={structureColumns}
 *   structureConstraints={constraints}
 *   structureIndexes={indexes}
 *   onStateChange={handleStateChange}
 *   onRefresh={handleRefresh}
 * />
 * ```
 */
export function TableView<T extends TableRowData = TableRowData>({
	tableInfo,
	data,
	columns,
	totalRows,
	isRowCountEstimate = false,
	loading = false,
	headerLoading = false,
	state: externalState,
	onStateChange,
	onRefresh,
	isRefreshing = false,
	emptyMessage = "No data found",
	className,
	structureColumns,
	structureConstraints,
	structureIndexes,
	structureLoading = false,
	constraintsData,
	constraintsLoading = false,
	indexesData,
	indexesLoading = false,
	activeTab: externalActiveTab,
	onTabChange,
	timing,
}: TableViewProps<T>) {
	// Tab state management
	const [internalActiveTab, setInternalActiveTab] = React.useState<TableViewTab>("data");
	const activeTab = externalActiveTab ?? internalActiveTab;
	const handleTabChange = React.useCallback(
		(value: string) => {
			const tab = value as TableViewTab;
			if (onTabChange) {
				onTabChange(tab);
			} else {
				setInternalActiveTab(tab);
			}
		},
		[onTabChange],
	);

	// State management
	const [internalState, updateInternalState] = useTableViewState(externalState, onStateChange);
	const state = externalState ?? internalState;
	const updateState = onStateChange
		? (updates: Partial<TableViewState>) => onStateChange({ ...state, ...updates })
		: updateInternalState;

	// Convert columns to DataGrid format
	const gridColumns = React.useMemo(() => columnsToDataGridDefs<T>(columns), [columns]);

	// Handle DataGrid state changes
	const handleGridStateChange = React.useCallback(
		(gridState: DataGridState) => {
			updateState(fromDataGridState(gridState, state));
		},
		[state, updateState],
	);

	// Convert state for DataGrid
	const gridState = React.useMemo(() => toDataGridState(state), [state]);

	// Context value
	const contextValue = React.useMemo<TableViewContextValue>(
		() => ({
			tableInfo,
			columns,
			totalRows: totalRows ?? null,
			isRowCountEstimate,
		}),
		[tableInfo, columns, totalRows, isRowCountEstimate],
	);

	return (
		<TableViewContext.Provider value={contextValue}>
			<div data-slot="table-view" className={cn("flex flex-col gap-4", className)}>
				{/* Header */}
				{headerLoading ? (
					<TableViewHeaderSkeleton />
				) : (
					<TableViewHeader
						tableInfo={tableInfo}
						rowCount={totalRows}
						isRowCountEstimate={isRowCountEstimate}
						isLoading={loading}
						onRefresh={onRefresh}
						isRefreshing={isRefreshing}
						timing={timing}
					/>
				)}

				{/* Tabs */}
				<Tabs value={activeTab} onValueChange={handleTabChange}>
					<TabsList>
						<TabsTrigger value="data">
							<TableIcon className="size-4" />
							Data
						</TabsTrigger>
						<TabsTrigger value="structure">
							<ColumnsIcon className="size-4" />
							Structure
						</TabsTrigger>
						<TabsTrigger value="constraints">
							<ShieldCheckIcon className="size-4" />
							Constraints
						</TabsTrigger>
						<TabsTrigger value="indexes">
							<DatabaseIcon className="size-4" />
							Indexes
						</TabsTrigger>
					</TabsList>

					{/* Data Tab Content */}
					<TabsContent value="data" className="mt-4">
						{/* Data Grid */}
						{columns.length === 0 && !loading ? (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>No columns</EmptyTitle>
									<EmptyDescription>This table has no visible columns.</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : data.length === 0 && !loading ? (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>No data</EmptyTitle>
									<EmptyDescription>{emptyMessage}</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<DataGrid
								data={data}
								columns={gridColumns}
								totalRows={totalRows ?? data.length}
								loading={loading}
								state={gridState}
								onStateChange={handleGridStateChange}
							>
								<DataGridToolbar />
								{loading ? (
									<DataGridSkeleton
										columns={columns.length || 5}
										rows={Math.min(state.pageSize, 10)}
									/>
								) : (
									<DataGridTable />
								)}
								<DataGridPagination />
							</DataGrid>
						)}
					</TabsContent>

					{/* Structure Tab Content */}
					<TabsContent value="structure" className="mt-4">
						{structureLoading ? (
							<TableStructureViewSkeleton />
						) : structureColumns && structureColumns.length > 0 ? (
							<TableStructureView
								columns={structureColumns}
								constraints={structureConstraints}
								indexes={structureIndexes}
								loading={structureLoading}
							/>
						) : (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>No structure data</EmptyTitle>
									<EmptyDescription>
										Column structure information is not available for this table.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}
					</TabsContent>

					{/* Constraints Tab Content */}
					<TabsContent value="constraints" className="mt-4">
						{constraintsLoading ? (
							<TableConstraintsViewSkeleton />
						) : constraintsData && constraintsData.length > 0 ? (
							<TableConstraintsView constraints={constraintsData} loading={constraintsLoading} />
						) : (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>No constraints</EmptyTitle>
									<EmptyDescription>This table has no constraints defined.</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}
					</TabsContent>

					{/* Indexes Tab Content */}
					<TabsContent value="indexes" className="mt-4">
						{indexesLoading ? (
							<TableIndexesViewSkeleton />
						) : indexesData && indexesData.length > 0 ? (
							<TableIndexesView indexes={indexesData} loading={indexesLoading} />
						) : (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>No indexes</EmptyTitle>
									<EmptyDescription>This table has no indexes defined.</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</TableViewContext.Provider>
	);
}

// ============================================================================
// Subcomponents (re-exports for convenience)
// ============================================================================

export { TableViewHeader, TableViewHeaderSkeleton } from "./table-view-header";
export {
	TableStructureView,
	TableStructureViewSkeleton,
	type StructureColumnInfo,
	type StructureConstraintInfo,
	type StructureIndexInfo,
	type TableStructureViewProps,
} from "./table-structure-view";
export {
	TableConstraintsView,
	TableConstraintsViewSkeleton,
	type ConstraintInfo,
	type TableConstraintsViewProps,
} from "./table-constraints-view";
export {
	TableIndexesView,
	TableIndexesViewSkeleton,
	type IndexViewInfo,
	type TableIndexesViewProps,
} from "./table-indexes-view";
