/**
 * TableView Component
 *
 * A complete table viewing component for database tables with:
 * - Schema.table header with type icon and row count
 * - Tabbed interface for Data, Structure, Constraints, and Indexes views
 * - Data grid with sorting and filtering
 * - Structure view with column metadata, constraints, and indexes
 * - Constraints view with detailed constraint metadata and visual relationship indicators
 * - Indexes view with index name, columns, uniqueness, method, and size information
 * - Pagination controls
 * - Loading states
 *
 * @example
 * ```tsx
 * import { TableView } from "~/components/table-view";
 *
 * <TableView
 *   tableInfo={{ schema: "public", table: "users", type: "table" }}
 *   data={rows}
 *   columns={columns}
 *   totalRows={1500}
 *   loading={isLoading}
 *   structureColumns={structureColumns}
 *   structureConstraints={constraints}
 *   structureIndexes={indexes}
 *   constraintsData={constraints}
 *   indexesData={indexes}
 *   onStateChange={handleStateChange}
 *   onRefresh={handleRefresh}
 * />
 * ```
 */

// Main component
export {
	TableView,
	TableViewHeader,
	TableViewHeaderSkeleton,
	TableStructureView,
	TableStructureViewSkeleton,
	TableConstraintsView,
	TableConstraintsViewSkeleton,
	TableIndexesView,
	TableIndexesViewSkeleton,
	useTableViewContext,
	type TableViewProps,
	type TableRowData,
	type TableViewTab,
	type StructureColumnInfo,
	type StructureConstraintInfo,
	type StructureIndexInfo,
	type TableStructureViewProps,
	type ConstraintInfo,
	type TableConstraintsViewProps,
	type IndexViewInfo,
	type TableIndexesViewProps,
} from "./table-view";

// State management
export {
	useTableViewState,
	buildFiltersFromState,
	buildOrderByFromState,
	calculateOffset,
	calculateTotalPages,
} from "./use-table-view-state";

// Types
export type {
	TableColumn,
	TableFilter,
	TableSort,
	TableViewState,
	TableIdentifier,
	FilterOperator,
	PageSize,
} from "./types";

export { PAGE_SIZE_OPTIONS } from "./types";

// Re-export timing badge for convenience
export { TimingBadge, type TimingMetrics } from "~/components/ui/timing-badge";
