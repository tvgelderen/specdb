import * as React from "react";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ArrowUpDownIcon,
	FilterIcon,
	XIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	MinusIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";

// ============================================================================
// Types
// ============================================================================

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDef<T> {
	id: string;
	header: string;
	accessorKey: keyof T;
	sortable?: boolean;
	filterable?: boolean;
	cell?: (value: T[keyof T], row: T) => React.ReactNode;
	width?: string;
}

export interface DataGridState {
	page: number;
	pageSize: number;
	sortColumn: string | null;
	sortDirection: SortDirection;
	filterColumn: string | null;
	filterValue: string;
}

export interface DataGridProps<T> {
	data: T[];
	columns: ColumnDef<T>[];
	totalRows?: number;
	loading?: boolean;
	state?: DataGridState;
	onStateChange?: (state: DataGridState) => void;
	className?: string;
	emptyMessage?: string;
	/** Enable row selection with checkboxes */
	selectable?: boolean;
	/** Currently selected row indices (relative to current page) */
	selectedRows?: Set<number>;
	/** Called when selection changes */
	onSelectionChange?: (selectedRows: Set<number>) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// ============================================================================
// Utility Hook
// ============================================================================

function useDataGridState(
	initialState?: Partial<DataGridState>,
	onStateChange?: (state: DataGridState) => void,
): [DataGridState, (updates: Partial<DataGridState>) => void] {
	const [state, setState] = React.useState<DataGridState>({
		page: 1,
		pageSize: 25,
		sortColumn: null,
		sortDirection: null,
		filterColumn: null,
		filterValue: "",
		...initialState,
	});

	const updateState = React.useCallback(
		(updates: Partial<DataGridState>) => {
			setState((prev) => {
				const newState = { ...prev, ...updates };
				onStateChange?.(newState);
				return newState;
			});
		},
		[onStateChange],
	);

	return [state, updateState];
}

// ============================================================================
// Context
// ============================================================================

interface DataGridContextValue<T> {
	state: DataGridState;
	updateState: (updates: Partial<DataGridState>) => void;
	columns: ColumnDef<T>[];
	data: T[];
	totalRows: number;
	loading: boolean;
	processedData: T[];
	selectable: boolean;
	selectedRows: Set<number>;
	onSelectionChange: (selectedRows: Set<number>) => void;
}

const DataGridContext = React.createContext<DataGridContextValue<unknown> | null>(null);

function useDataGridContext<T>() {
	const context = React.useContext(DataGridContext);
	if (!context) {
		throw new Error("DataGrid components must be used within a DataGrid");
	}
	return context as DataGridContextValue<T>;
}

// ============================================================================
// Data Processing
// ============================================================================

function processData<T>(data: T[], columns: ColumnDef<T>[], state: DataGridState): T[] {
	let result = [...data];

	// Apply filtering
	if (state.filterColumn && state.filterValue) {
		const column = columns.find((col) => col.id === state.filterColumn);
		if (column) {
			result = result.filter((row) => {
				const value = row[column.accessorKey];
				if (value === null || value === undefined) return false;
				return String(value).toLowerCase().includes(state.filterValue.toLowerCase());
			});
		}
	}

	// Apply sorting
	if (state.sortColumn && state.sortDirection) {
		const column = columns.find((col) => col.id === state.sortColumn);
		if (column) {
			result.sort((a, b) => {
				const aVal = a[column.accessorKey];
				const bVal = b[column.accessorKey];

				if (aVal === null || aVal === undefined) return 1;
				if (bVal === null || bVal === undefined) return -1;

				let comparison = 0;
				if (typeof aVal === "string" && typeof bVal === "string") {
					comparison = aVal.localeCompare(bVal);
				} else if (typeof aVal === "number" && typeof bVal === "number") {
					comparison = aVal - bVal;
				} else {
					comparison = String(aVal).localeCompare(String(bVal));
				}

				return state.sortDirection === "desc" ? -comparison : comparison;
			});
		}
	}

	return result;
}

// ============================================================================
// Main DataGrid Component
// ============================================================================

function DataGrid<T extends Record<string, unknown>>({
	data,
	columns,
	totalRows,
	loading = false,
	state: externalState,
	onStateChange,
	className,
	emptyMessage = "No data available",
	selectable = false,
	selectedRows: externalSelectedRows,
	onSelectionChange: externalOnSelectionChange,
	children,
}: DataGridProps<T> & { children?: React.ReactNode }) {
	const [internalState, updateInternalState] = useDataGridState(externalState, onStateChange);
	const state = externalState ?? internalState;
	const updateState = onStateChange
		? (updates: Partial<DataGridState>) => onStateChange({ ...state, ...updates })
		: updateInternalState;

	// Internal selection state (used if no external state provided)
	const [internalSelectedRows, setInternalSelectedRows] = React.useState<Set<number>>(new Set());
	const selectedRows = externalSelectedRows ?? internalSelectedRows;
	const onSelectionChange = externalOnSelectionChange ?? setInternalSelectedRows;

	const processedData = React.useMemo(() => processData(data, columns, state), [data, columns, state]);

	const effectiveTotalRows = totalRows ?? processedData.length;

	const contextValue: DataGridContextValue<T> = {
		state,
		updateState,
		columns,
		data,
		totalRows: effectiveTotalRows,
		loading,
		processedData,
		selectable,
		selectedRows,
		onSelectionChange,
	};

	return (
		<DataGridContext.Provider value={contextValue as DataGridContextValue<unknown>}>
			<div data-slot="data-grid" className={cn("flex flex-col gap-4", className)}>
				{children ?? (
					<>
						<DataGridToolbar />
						<DataGridTable />
						<DataGridPagination />
					</>
				)}
			</div>
		</DataGridContext.Provider>
	);
}

// ============================================================================
// Toolbar Component
// ============================================================================

function DataGridToolbar({ className, ...props }: React.ComponentProps<"div">) {
	const { state, updateState, columns } = useDataGridContext();
	const filterableColumns = columns.filter((col) => col.filterable !== false);

	const handleFilterColumnChange = (columnId: string) => {
		updateState({
			filterColumn: columnId || null,
			filterValue: "",
			page: 1,
		});
	};

	const handleFilterValueChange = (value: string) => {
		updateState({
			filterValue: value,
			page: 1,
		});
	};

	const clearFilter = () => {
		updateState({
			filterColumn: null,
			filterValue: "",
			page: 1,
		});
	};

	return (
		<div data-slot="data-grid-toolbar" className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
			{filterableColumns.length > 0 && (
				<>
					<Select value={state.filterColumn ?? ""} onValueChange={handleFilterColumnChange}>
						<SelectTrigger size="sm" className="w-[150px]">
							<FilterIcon className="size-4 mr-1" />
							<SelectValue placeholder="Filter by..." />
						</SelectTrigger>
						<SelectContent>
							{filterableColumns.map((column) => (
								<SelectItem key={column.id} value={column.id}>
									{column.header}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{state.filterColumn && (
						<div className="flex items-center gap-2">
							<Input
								placeholder={`Filter ${columns.find((c) => c.id === state.filterColumn)?.header ?? ""}...`}
								value={state.filterValue}
								onChange={(e) => handleFilterValueChange(e.target.value)}
								className="h-8 w-[200px]"
							/>
							<Button variant="ghost" size="icon" onClick={clearFilter} className="size-8 focus-visible:ring-0">
								<XIcon className="size-4" />
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}

// ============================================================================
// Table Component
// ============================================================================

function DataGridTable({ className, ...props }: React.ComponentProps<"div">) {
	const { state, updateState, columns, loading, processedData, selectable, selectedRows, onSelectionChange } =
		useDataGridContext();

	const startIndex = (state.page - 1) * state.pageSize;
	const endIndex = Math.min(startIndex + state.pageSize, processedData.length);
	const paginatedData = processedData.slice(startIndex, endIndex);

	const handleSort = (columnId: string) => {
		const column = columns.find((col) => col.id === columnId);
		if (!column?.sortable) return;

		let newDirection: SortDirection = "asc";
		if (state.sortColumn === columnId) {
			if (state.sortDirection === "asc") {
				newDirection = "desc";
			} else if (state.sortDirection === "desc") {
				newDirection = null;
			}
		}

		updateState({
			sortColumn: newDirection ? columnId : null,
			sortDirection: newDirection,
		});
	};

	const getSortIcon = (columnId: string) => {
		if (state.sortColumn !== columnId) {
			return <ArrowUpDownIcon className="size-4 text-muted-foreground" />;
		}
		if (state.sortDirection === "asc") {
			return <ArrowUpIcon className="size-4" />;
		}
		return <ArrowDownIcon className="size-4" />;
	};

	// Selection handlers
	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			const allIndices = new Set(paginatedData.map((_, idx) => idx));
			onSelectionChange(allIndices);
		} else {
			onSelectionChange(new Set());
		}
	};

	const handleSelectRow = (rowIndex: number, checked: boolean) => {
		const newSelection = new Set(selectedRows);
		if (checked) {
			newSelection.add(rowIndex);
		} else {
			newSelection.delete(rowIndex);
		}
		onSelectionChange(newSelection);
	};

	const allSelected = paginatedData.length > 0 && selectedRows.size === paginatedData.length;
	const someSelected = selectedRows.size > 0 && selectedRows.size < paginatedData.length;

	if (loading) {
		return (
			<DataGridSkeleton
				columns={selectable ? columns.length + 1 : columns.length}
				rows={state.pageSize > 10 ? 10 : state.pageSize}
			/>
		);
	}

	return (
		<div data-slot="data-grid-table" className={cn("rounded-md border overflow-auto", className)} {...props}>
			<table className="w-full caption-bottom text-sm">
				<thead className="border-b bg-muted/50">
					<tr>
						{selectable && (
							<th className="h-10 w-12 px-4 text-left align-middle">
								<Checkbox
									checked={allSelected}
									onCheckedChange={handleSelectAll}
									aria-label="Select all rows"
								/>
								{someSelected && (
									<MinusIcon className="absolute size-3 text-primary pointer-events-none" />
								)}
							</th>
						)}
						{columns.map((column) => (
							<th
								key={column.id}
								className={cn(
									"h-10 px-4 text-left align-middle font-medium text-muted-foreground",
									column.sortable && "cursor-pointer select-none hover:bg-muted/80 transition-colors",
								)}
								style={{ width: column.width }}
								onClick={() => column.sortable && handleSort(column.id)}
							>
								<div className="flex items-center gap-2">
									{column.header}
									{column.sortable && getSortIcon(column.id)}
								</div>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{paginatedData.length === 0 ? (
						<tr>
							<td
								colSpan={selectable ? columns.length + 1 : columns.length}
								className="h-24 text-center text-muted-foreground"
							>
								No data available
							</td>
						</tr>
					) : (
						paginatedData.map((row, rowIndex) => {
							const isSelected = selectedRows.has(rowIndex);
							return (
								<tr
									key={rowIndex}
									data-state={isSelected ? "selected" : undefined}
									className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
								>
									{selectable && (
										<td className="w-12 px-4 align-middle">
											<Checkbox
												checked={isSelected}
												onCheckedChange={(checked) => handleSelectRow(rowIndex, checked === true)}
												aria-label={`Select row ${rowIndex + 1}`}
											/>
										</td>
									)}
									{columns.map((column) => {
										const typedRow = row as Record<string, unknown>;
										const value = typedRow[column.accessorKey as string];
										return (
											<td key={column.id} className="p-4 align-middle max-w-xs">
												<div className="truncate">
													{column.cell
														? column.cell(value as never, row as never)
														: value !== null && value !== undefined
															? String(value)
															: "-"}
												</div>
											</td>
										);
									})}
								</tr>
							);
						})
					)}
				</tbody>
			</table>
		</div>
	);
}

// ============================================================================
// Skeleton Component
// ============================================================================

function DataGridSkeleton({
	columns = 4,
	rows = 10,
	className,
	...props
}: { columns?: number; rows?: number } & React.ComponentProps<"div">) {
	return (
		<div data-slot="data-grid-skeleton" className={cn("rounded-md border overflow-hidden", className)} {...props}>
			<table className="w-full text-sm">
				<thead className="border-b bg-muted/50">
					<tr>
						{Array.from({ length: columns }).map((_, i) => (
							<th key={i} className="h-10 px-4">
								<Skeleton className="h-4 w-20" />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{Array.from({ length: rows }).map((_, rowIndex) => (
						<tr key={rowIndex} className="border-b">
							{Array.from({ length: columns }).map((_, colIndex) => (
								<td key={colIndex} className="p-4">
									<Skeleton className="h-4 w-full" />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// ============================================================================
// Pagination Component
// ============================================================================

function DataGridPagination({ className, ...props }: React.ComponentProps<"div">) {
	const { state, updateState, processedData, totalRows } = useDataGridContext();

	const totalPages = Math.ceil(processedData.length / state.pageSize);
	const startRow = processedData.length === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
	const endRow = Math.min(state.page * state.pageSize, processedData.length);

	const handlePageSizeChange = (value: string) => {
		const newPageSize = parseInt(value, 10) as PageSize;
		updateState({
			pageSize: newPageSize,
			page: 1,
		});
	};

	const goToPage = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			updateState({ page });
		}
	};

	return (
		<div
			data-slot="data-grid-pagination"
			className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 px-2", className)}
			{...props}
		>
			{/* Row count display */}
			<div className="text-sm text-muted-foreground">
				{processedData.length === 0 ? (
					"No rows"
				) : (
					<>
						Showing <span className="font-medium text-foreground">{startRow}</span> to{" "}
						<span className="font-medium text-foreground">{endRow}</span> of{" "}
						<span className="font-medium text-foreground">{processedData.length}</span> rows
						{totalRows !== processedData.length && (
							<span className="text-muted-foreground"> (filtered from {totalRows})</span>
						)}
					</>
				)}
			</div>

			<div className="flex items-center gap-4">
				{/* Page size selector */}
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Rows per page</span>
					<Select value={String(state.pageSize)} onValueChange={handlePageSizeChange}>
						<SelectTrigger size="sm" className="w-[70px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZE_OPTIONS.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Page navigation */}
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="icon"
						className="size-8 focus-visible:ring-0"
						onClick={() => goToPage(1)}
						disabled={state.page === 1}
					>
						<ChevronsLeftIcon className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-8 focus-visible:ring-0"
						onClick={() => goToPage(state.page - 1)}
						disabled={state.page === 1}
					>
						<ChevronLeftIcon className="size-4" />
					</Button>

					<span className="px-2 text-sm text-muted-foreground">
						Page <span className="font-medium text-foreground">{state.page}</span> of{" "}
						<span className="font-medium text-foreground">{totalPages || 1}</span>
					</span>

					<Button
						variant="outline"
						size="icon"
						className="size-8 focus-visible:ring-0"
						onClick={() => goToPage(state.page + 1)}
						disabled={state.page >= totalPages}
					>
						<ChevronRightIcon className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-8 focus-visible:ring-0"
						onClick={() => goToPage(totalPages)}
						disabled={state.page >= totalPages}
					>
						<ChevronsRightIcon className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Row Count Component (standalone)
// ============================================================================

function DataGridRowCount({ className, ...props }: React.ComponentProps<"div">) {
	const { processedData, totalRows } = useDataGridContext();

	return (
		<div data-slot="data-grid-row-count" className={cn("text-sm text-muted-foreground", className)} {...props}>
			<span className="font-medium text-foreground">{processedData.length}</span> rows
			{totalRows !== processedData.length && <span> (filtered from {totalRows})</span>}
		</div>
	);
}

// ============================================================================
// Exports
// ============================================================================

export {
	DataGrid,
	DataGridToolbar,
	DataGridTable,
	DataGridSkeleton,
	DataGridPagination,
	DataGridRowCount,
	useDataGridState,
};
