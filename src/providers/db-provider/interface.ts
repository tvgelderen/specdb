import type {
	BaseConnectionConfig,
	CapabilityMap,
	ColumnInfo,
	ConstraintInfo,
	DatabaseInfo,
	DbProviderEnvelope,
	IndexInfo,
	ProviderStatus,
	ProviderType,
	QueryResult,
	RowDeleteOptions,
	RowInsertOptions,
	RowQueryOptions,
	RowUpdateOptions,
	SchemaInfo,
	TableInfo,
	TableStructure,
} from "./types";

/**
 * Base interface for all database providers.
 * Provides a consistent API for database operations with standardized response envelopes.
 *
 * @template TConfig - The connection configuration type for this provider
 */
export interface DbProvider<TConfig extends BaseConnectionConfig = BaseConnectionConfig> {
	/**
	 * The provider type identifier
	 */
	readonly type: ProviderType;

	/**
	 * The provider version
	 */
	readonly version: string;

	/**
	 * Get the current connection configuration
	 */
	getConfig(): TConfig;

	// ============================================
	// Connection Management
	// ============================================

	/**
	 * Establish connection to the database
	 */
	connect(): Promise<DbProviderEnvelope<void>>;

	/**
	 * Close all connections and clean up resources
	 */
	disconnect(): Promise<DbProviderEnvelope<void>>;

	/**
	 * Test the connection without establishing a persistent connection
	 */
	testConnection(): Promise<DbProviderEnvelope<{ success: boolean; message: string }>>;

	/**
	 * Get the current connection status
	 */
	getStatus(): Promise<DbProviderEnvelope<ProviderStatus>>;

	// ============================================
	// Capability Detection
	// ============================================

	/**
	 * Get the capability map for this provider
	 * Used by UI to determine which features to show/hide
	 */
	getCapabilities(): CapabilityMap;

	/**
	 * Check if a specific capability is supported
	 */
	hasCapability(capability: string): boolean;

	// ============================================
	// Database Metadata
	// ============================================

	/**
	 * List all databases
	 * Requires: metadata.databases capability
	 */
	listDatabases(): Promise<DbProviderEnvelope<DatabaseInfo[]>>;

	/**
	 * List all schemas in the current database
	 * Requires: metadata.schemas capability
	 */
	listSchemas(): Promise<DbProviderEnvelope<SchemaInfo[]>>;

	/**
	 * List all tables in a schema
	 * Requires: metadata.tables capability
	 */
	listTables(schema?: string): Promise<DbProviderEnvelope<TableInfo[]>>;

	/**
	 * Get column information for a table
	 * Requires: metadata.columns capability
	 */
	getColumns(schema: string, table: string): Promise<DbProviderEnvelope<ColumnInfo[]>>;

	/**
	 * Get index information for a table
	 * Requires: metadata.indexes capability
	 */
	getIndexes(schema: string, table: string): Promise<DbProviderEnvelope<IndexInfo[]>>;

	/**
	 * Get constraint information for a table
	 * Requires: metadata.constraints capability
	 */
	getConstraints(schema: string, table: string): Promise<DbProviderEnvelope<ConstraintInfo[]>>;

	/**
	 * Get complete table structure (columns, indexes, constraints)
	 * Requires: metadata.tableStructure capability
	 */
	getTableStructure(schema: string, table: string): Promise<DbProviderEnvelope<TableStructure>>;

	// ============================================
	// Data Operations
	// ============================================

	/**
	 * Select rows from a table
	 * Requires: data.select capability
	 */
	selectRows(options: RowQueryOptions): Promise<DbProviderEnvelope<QueryResult>>;

	/**
	 * Insert a row into a table
	 * Requires: data.insert capability
	 */
	insertRow(options: RowInsertOptions): Promise<DbProviderEnvelope<QueryResult>>;

	/**
	 * Update rows in a table
	 * Requires: data.update capability
	 */
	updateRows(options: RowUpdateOptions): Promise<DbProviderEnvelope<QueryResult>>;

	/**
	 * Delete rows from a table
	 * Requires: data.delete capability
	 */
	deleteRows(options: RowDeleteOptions): Promise<DbProviderEnvelope<QueryResult>>;

	/**
	 * Execute a raw SQL query
	 * Requires: data.rawQuery capability
	 */
	executeQuery(sql: string, params?: unknown[]): Promise<DbProviderEnvelope<QueryResult>>;

	// ============================================
	// Transaction Support
	// ============================================

	/**
	 * Execute a callback within a transaction
	 * Requires: transaction.basic capability
	 */
	transaction<T>(
		callback: (client: unknown) => Promise<T>,
		maxRetries?: number
	): Promise<DbProviderEnvelope<T>>;
}
