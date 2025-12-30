import { z } from "zod/v4";

/**
 * Pagination constants for explorer procedures
 */
export const EXPLORER_DEFAULT_LIMIT = 50;
export const EXPLORER_MAX_LIMIT = 500;

/**
 * Pagination input schema
 */
export const paginationSchema = z.object({
	limit: z.number().int().min(1).max(EXPLORER_MAX_LIMIT).default(EXPLORER_DEFAULT_LIMIT),
	offset: z.number().int().min(0).default(0),
});

/**
 * Pagination metadata for responses
 */
export interface PaginationMeta {
	offset: number;
	limit: number;
	total: number;
	hasMore: boolean;
}

/**
 * Tree node types for UI rendering
 */
export type TreeNodeType =
	| "database"
	| "schema"
	| "table"
	| "view"
	| "materialized_view"
	| "folder";

/**
 * Tree node metadata for UI rendering
 */
export interface TreeNodeMeta {
	/** Unique identifier for the node */
	id: string;
	/** Type of tree node */
	type: TreeNodeType;
	/** Whether this node can be expanded (has children) */
	isExpandable: boolean;
	/** Whether this node is currently loading children */
	isLoading?: boolean;
	/** Icon hint for UI rendering */
	icon?: string;
	/** Additional context for the node */
	context?: Record<string, unknown>;
}

/**
 * Explorer permission levels
 */
export type ExplorerPermission =
	| "explorer.view"
	| "explorer.databases.list"
	| "explorer.databases.write"
	| "explorer.databases.delete"
	| "explorer.schemas.list"
	| "explorer.tables.list"
	| "explorer.tables.read"
	| "explorer.tables.write"
	| "explorer.tables.delete";

/**
 * Database info with tree metadata
 */
export interface ExplorerDatabaseInfo {
	name: string;
	owner: string;
	encoding: string;
	size: string;
	tablespace: string;
	/** Tree rendering metadata */
	treeMeta: TreeNodeMeta;
}

/**
 * Schema info with tree metadata
 */
export interface ExplorerSchemaInfo {
	name: string;
	owner: string;
	/** Database this schema belongs to */
	database: string;
	/** Tree rendering metadata */
	treeMeta: TreeNodeMeta;
}

/**
 * Table info with tree metadata
 */
export interface ExplorerTableInfo {
	name: string;
	schema: string;
	type: "table" | "view" | "materialized_view";
	owner: string;
	rowCount: number | null;
	size: string | null;
	/** Tree rendering metadata */
	treeMeta: TreeNodeMeta;
}

/**
 * Paginated response for explorer procedures
 */
export interface PaginatedExplorerResponse<T> {
	items: T[];
	pagination: PaginationMeta;
	/** Request timestamp */
	timestamp: number;
}

/**
 * Explorer request context for permission checking
 */
export interface ExplorerContext {
	/** User permissions for explorer operations */
	permissions: ExplorerPermission[];
	/** Current connection identifier */
	connectionId?: string;
}
