import type { PoolConfig } from "pg";

export const DEFAULT_QUERY_LIMIT = 100;
export const DEFAULT_QUERY_TIMEOUT_MS = 30000;
export const MAX_QUERY_LIMIT = 10000;
export const MAX_QUERY_TIMEOUT_MS = 60000;

export interface PostgresConnectionConfig extends PoolConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	ssl?: boolean | { rejectUnauthorized: boolean };
	max?: number;
	idleTimeoutMillis?: number;
	connectionTimeoutMillis?: number;
}

export interface DatabaseInfo {
	name: string;
	owner: string;
	encoding: string;
	size: string;
	tablespace: string;
}

export interface SchemaInfo {
	name: string;
	owner: string;
}

export interface TableInfo {
	name: string;
	schema: string;
	type: "table" | "view" | "materialized_view";
	owner: string;
	rowCount: number | null;
	size: string | null;
}

export interface ColumnInfo {
	name: string;
	dataType: string;
	isNullable: boolean;
	defaultValue: string | null;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	characterMaxLength: number | null;
	numericPrecision: number | null;
	numericScale: number | null;
	ordinalPosition: number;
}

export interface IndexInfo {
	name: string;
	tableName: string;
	columns: string[];
	isUnique: boolean;
	isPrimary: boolean;
	indexType: string;
	definition: string;
	size: string | null;
}

export interface ConstraintInfo {
	name: string;
	type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK" | "EXCLUSION";
	tableName: string;
	columns: string[];
	definition: string;
	referencedTable?: string;
	referencedColumns?: string[];
	updateRule?: string;
	deleteRule?: string;
	checkClause?: string;
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
	operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "ILIKE" | "IN" | "IS NULL" | "IS NOT NULL";
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
