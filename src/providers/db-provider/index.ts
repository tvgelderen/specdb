// Core interface
export type { DbProvider } from "./interface";

// Types
export type {
	// Envelope types
	DbProviderEnvelope,
	ResponseMeta,
	ResponseError,
	// Capability types
	DbCapability,
	CapabilityInfo,
	CapabilityMap,
	// Provider types
	ProviderType,
	ProviderStatus,
	ProviderRegistration,
	BaseConnectionConfig,
	// Database metadata types
	DatabaseInfo,
	SchemaInfo,
	TableInfo,
	ColumnInfo,
	IndexInfo,
	ConstraintInfo,
	TableStructure,
	// Query types
	QueryResult,
	FilterOperator,
	RowFilter,
	RowQueryOptions,
	RowInsertOptions,
	RowUpdateOptions,
	RowDeleteOptions,
} from "./types";

// Registry
export { ProviderRegistry, ProviderRegistryClass } from "./registry";

// Envelope utilities
export {
	createSuccessEnvelope,
	createErrorEnvelope,
	createMeta,
	withEnvelope,
	isSuccess,
	isError,
	getFirstError,
	unwrap,
	ErrorCodes,
	createProviderError,
} from "./envelope";
export type { ErrorCode } from "./envelope";
