import * as React from "react";
import type { TableViewState, TableFilter } from "./types";

/**
 * Default initial state for the table view
 */
const DEFAULT_STATE: TableViewState = {
	page: 1,
	pageSize: 25,
	sortColumn: null,
	sortDirection: null,
	filterColumn: null,
	filterValue: "",
	filters: [],
};

/**
 * Hook for managing table view state
 *
 * Provides controlled and uncontrolled state management for the TableView component.
 * When external state is provided, it acts as a controlled component.
 * Otherwise, it manages its own internal state.
 *
 * @param initialState - Optional initial state values
 * @param onStateChange - Optional callback when state changes
 * @returns Tuple of [state, updateState function]
 */
export function useTableViewState(
	initialState?: Partial<TableViewState>,
	onStateChange?: (state: TableViewState) => void
): [TableViewState, (updates: Partial<TableViewState>) => void] {
	const [state, setState] = React.useState<TableViewState>({
		...DEFAULT_STATE,
		...initialState,
	});

	const updateState = React.useCallback(
		(updates: Partial<TableViewState>) => {
			setState((prev) => {
				const newState = { ...prev, ...updates };
				onStateChange?.(newState);
				return newState;
			});
		},
		[onStateChange]
	);

	return [state, updateState];
}

/**
 * Build server-side filters from the current table state
 *
 * Converts the filter column/value from the toolbar into a format
 * suitable for the TRPC API.
 *
 * @param state - Current table view state
 * @returns Array of filters for the API
 */
export function buildFiltersFromState(state: TableViewState): TableFilter[] {
	const filters: TableFilter[] = [...state.filters];

	// Add toolbar filter if present
	if (state.filterColumn && state.filterValue) {
		filters.push({
			column: state.filterColumn,
			operator: "ILIKE",
			value: `%${state.filterValue}%`,
		});
	}

	return filters;
}

/**
 * Build server-side order by from the current table state
 *
 * @param state - Current table view state
 * @returns Array of order by clauses for the API
 */
export function buildOrderByFromState(
	state: TableViewState
): Array<{ column: string; direction: "ASC" | "DESC" }> {
	if (!state.sortColumn || !state.sortDirection) {
		return [];
	}

	return [
		{
			column: state.sortColumn,
			direction: state.sortDirection === "asc" ? "ASC" : "DESC",
		},
	];
}

/**
 * Calculate pagination offset from page and page size
 *
 * @param page - Current page (1-indexed)
 * @param pageSize - Number of rows per page
 * @returns Offset value for the API
 */
export function calculateOffset(page: number, pageSize: number): number {
	return (page - 1) * pageSize;
}

/**
 * Calculate total pages from row count and page size
 *
 * @param totalRows - Total number of rows
 * @param pageSize - Number of rows per page
 * @returns Total number of pages
 */
export function calculateTotalPages(totalRows: number, pageSize: number): number {
	return Math.ceil(totalRows / pageSize);
}
