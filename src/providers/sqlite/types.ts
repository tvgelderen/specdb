import type { BaseConnectionConfig } from "~/providers/db-provider/types";

export const DEFAULT_QUERY_LIMIT = 100;
export const DEFAULT_QUERY_TIMEOUT_MS = 30000;
export const MAX_QUERY_LIMIT = 10000;
export const MAX_QUERY_TIMEOUT_MS = 60000;

/**
 * SQLite connection configuration
 * SQLite uses file-based storage, so the main config is the file path
 */
export interface SqliteConnectionConfig extends BaseConnectionConfig {
	/** Path to the SQLite database file */
	filepath: string;
	/** Open database in readonly mode */
	readonly?: boolean;
	/** Timeout for acquiring a connection (ms) */
	timeout?: number;
	/** If true, throws error if file doesn't exist. If false, creates new database */
	fileMustExist?: boolean;
	/** Enable WAL mode for better concurrent access (default: true) */
	enableWAL?: boolean;
	/** Enable foreign key constraints (default: true) */
	enableForeignKeys?: boolean;
}

/**
 * SQLite database info (for the single database in a file)
 */
export interface DatabaseInfo {
	name: string;
	filepath: string;
	size: string;
}

/**
 * SQLite doesn't have schemas, but we use "main" as the default
 */
export interface SchemaInfo {
	name: string;
}

export interface TableInfo {
	name: string;
	schema: string;
	type: "table" | "view";
	rowCount: number | null;
}

export interface ColumnInfo {
	name: string;
	dataType: string;
	isNullable: boolean;
	defaultValue: string | null;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	ordinalPosition: number;
}

export interface IndexInfo {
	name: string;
	tableName: string;
	columns: string[];
	isUnique: boolean;
	isPrimary: boolean;
	definition: string;
}

export interface ConstraintInfo {
	name: string;
	type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK";
	tableName: string;
	columns: string[];
	definition: string;
	referencedTable?: string;
	referencedColumns?: string[];
}

export interface TableStructure {
	tableName: string;
	schema: string;
	columns: ColumnInfo[];
	indexes: IndexInfo[];
	constraints: ConstraintInfo[];
}

/**
 * Timing metrics for database operations
 */
export interface TimingMetrics {
	/** Total handler duration in milliseconds (client-perceived latency) */
	totalMs: number;
	/** Database roundtrip time in milliseconds */
	dbMs: number;
}

export interface QueryResult<T = Record<string, unknown>> {
	rows: T[];
	rowCount: number;
	fields: {
		name: string;
		dataType: string;
	}[];
	/** Optional timing metrics for the query */
	timing?: TimingMetrics;
}

export interface RowFilter {
	column: string;
	operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "ILIKE" | "GLOB" | "IN" | "IS NULL" | "IS NOT NULL";
	value: unknown;
}

export interface RowQueryOptions {
	schema?: string;
	table: string;
	columns?: string[];
	filters?: RowFilter[];
	orderBy?: { column: string; direction: "ASC" | "DESC" }[];
	limit?: number;
	offset?: number;
	queryTimeoutMs?: number;
}

export interface RowCountOptions {
	schema?: string;
	table: string;
	filters?: RowFilter[];
	queryTimeoutMs?: number;
}

export interface RowInsertOptions {
	schema?: string;
	table: string;
	data: Record<string, unknown>;
}

export interface RowUpdateOptions {
	schema?: string;
	table: string;
	data: Record<string, unknown>;
	where: RowFilter[];
}

export interface RowDeleteOptions {
	schema?: string;
	table: string;
	where: RowFilter[];
}
