/**
 * Standard envelope types for consistent API responses
 */

/**
 * Metadata for API responses
 */
export interface ResponseMeta {
	timestamp: number;
	duration?: number;
	provider: string;
	version: string;
}

/**
 * Error structure for API responses
 */
export interface ResponseError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
	stack?: string;
}

/**
 * Standard envelope for all provider responses
 */
export interface DbProviderEnvelope<T> {
	data: T | null;
	meta: ResponseMeta;
	errors: ResponseError[];
}

/**
 * Capability identifiers for providers
 */
export type DbCapability =
	// Connection capabilities
	| "connection.test"
	| "connection.pool"
	// Database metadata capabilities
	| "metadata.databases"
	| "metadata.schemas"
	| "metadata.tables"
	| "metadata.columns"
	| "metadata.indexes"
	| "metadata.constraints"
	| "metadata.tableStructure"
	// Data operations
	| "data.select"
	| "data.insert"
	| "data.update"
	| "data.delete"
	| "data.rawQuery"
	// Transaction capabilities
	| "transaction.basic"
	| "transaction.savepoints"
	| "transaction.isolation"
	// Advanced features
	| "feature.streaming"
	| "feature.bulkOperations"
	| "feature.explain"
	| "feature.notifications";

/**
 * Capability metadata for UI feature detection
 */
export interface CapabilityInfo {
	capability: DbCapability;
	supported: boolean;
	version?: string;
	notes?: string;
}

/**
 * Complete capability map for a provider
 */
export interface CapabilityMap {
	provider: string;
	version: string;
	capabilities: Record<DbCapability, CapabilityInfo>;
}

/**
 * Provider status information
 */
export interface ProviderStatus {
	connected: boolean;
	poolSize?: number;
	activeConnections?: number;
	idleConnections?: number;
	lastActivity?: number;
}

/**
 * Base connection configuration that all providers must support.
 * This is intentionally minimal to allow providers to extend with their own config.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseConnectionConfig {
	// Marker interface - providers extend this with their specific configuration
}

/**
 * Common database metadata types (shared across providers)
 */
export interface DatabaseInfo {
	name: string;
	owner?: string;
	encoding?: string;
	size?: string;
	tablespace?: string;
}

export interface SchemaInfo {
	name: string;
	owner?: string;
}

export interface TableInfo {
	name: string;
	schema: string;
	type: "table" | "view" | "materialized_view";
	owner?: string;
	rowCount?: number | null;
	size?: string | null;
}

export interface ColumnInfo {
	name: string;
	dataType: string;
	isNullable: boolean;
	defaultValue: string | null;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	characterMaxLength?: number | null;
	numericPrecision?: number | null;
	numericScale?: number | null;
	ordinalPosition: number;
}

export interface IndexInfo {
	name: string;
	tableName: string;
	columns: string[];
	isUnique: boolean;
	isPrimary: boolean;
	indexType?: string;
	definition?: string;
}

export interface ConstraintInfo {
	name: string;
	type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK" | "EXCLUSION";
	tableName: string;
	columns: string[];
	definition?: string;
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
 * Query result type
 */
export interface QueryResult<T = Record<string, unknown>> {
	rows: T[];
	rowCount: number;
	fields: {
		name: string;
		dataType: string;
	}[];
}

/**
 * Filter operators for row queries
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
	| "IN"
	| "IS NULL"
	| "IS NOT NULL";

/**
 * Row filter for queries
 */
export interface RowFilter {
	column: string;
	operator: FilterOperator;
	value: unknown;
}

/**
 * Options for selecting rows
 */
export interface RowQueryOptions {
	schema?: string;
	table: string;
	columns?: string[];
	filters?: RowFilter[];
	orderBy?: { column: string; direction: "ASC" | "DESC" }[];
	limit?: number;
	offset?: number;
}

/**
 * Options for inserting rows
 */
export interface RowInsertOptions {
	schema?: string;
	table: string;
	data: Record<string, unknown>;
}

/**
 * Options for updating rows
 */
export interface RowUpdateOptions {
	schema?: string;
	table: string;
	data: Record<string, unknown>;
	where: RowFilter[];
}

/**
 * Options for deleting rows
 */
export interface RowDeleteOptions {
	schema?: string;
	table: string;
	where: RowFilter[];
}

/**
 * Provider type identifiers
 */
export type ProviderType = "postgres" | "mysql" | "sqlite" | "mongodb" | "redis";

/**
 * Provider factory function type
 * Uses unknown return type to avoid circular dependency with DbProvider interface
 */
export type ProviderFactory<TConfig extends BaseConnectionConfig = BaseConnectionConfig> = (
	config: TConfig
) => unknown;

/**
 * Provider registration info
 */
export interface ProviderRegistration<TConfig extends BaseConnectionConfig = BaseConnectionConfig> {
	type: ProviderType;
	name: string;
	description: string;
	version: string;
	capabilities: DbCapability[];
	factory: ProviderFactory<TConfig>;
}
