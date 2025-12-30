import type { SortDirection } from "~/components/ui/data-grid";

/**
 * Column information from the database
 */
export interface TableColumn {
	name: string;
	dataType: string;
	isNullable: boolean;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	defaultValue: string | null;
}

/**
 * Filter operator types supported by the table view
 */
export type FilterOperator =
	| "="
	| "!="
	| ">"
	| "<"
	| ">="
	| "<="
	| "LIKE"
	| "ILIKE"
	| "IS NULL"
	| "IS NOT NULL";

/**
 * A single filter condition
 */
export interface TableFilter {
	column: string;
	operator: FilterOperator;
	value: unknown;
}

/**
 * Sort configuration for the table
 */
export interface TableSort {
	column: string;
	direction: "ASC" | "DESC";
}

/**
 * Table view state for managing pagination, sorting, and filtering
 */
export interface TableViewState {
	/** Current page number (1-indexed) */
	page: number;
	/** Number of rows per page */
	pageSize: number;
	/** Current sort column */
	sortColumn: string | null;
	/** Current sort direction */
	sortDirection: SortDirection;
	/** Column being filtered */
	filterColumn: string | null;
	/** Filter value */
	filterValue: string;
	/** Applied filters for server-side filtering */
	filters: TableFilter[];
}

/**
 * Table identification info
 */
export interface TableIdentifier {
	/** Database schema name */
	schema: string;
	/** Table name */
	table: string;
	/** Table type (table, view, or materialized_view) */
	type?: "table" | "view" | "materialized_view";
}

/**
 * Default page size options
 */
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
