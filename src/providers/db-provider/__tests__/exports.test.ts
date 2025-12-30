import { describe, it, expect } from "bun:test";

// Test that all expected exports are available from the main index
import {
	// Registry
	ProviderRegistry,
	ProviderRegistryClass,
	// Envelope utilities
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
} from "../index";

// Test type exports (these are compile-time checks)
import type {
	DbProvider,
	DbProviderEnvelope,
	ResponseMeta,
	ResponseError,
	DbCapability,
	CapabilityInfo,
	CapabilityMap,
	ProviderType,
	ProviderStatus,
	ProviderRegistration,
	BaseConnectionConfig,
	DatabaseInfo,
	SchemaInfo,
	TableInfo,
	ColumnInfo,
	IndexInfo,
	ConstraintInfo,
	TableStructure,
	QueryResult,
	FilterOperator,
	RowFilter,
	RowQueryOptions,
	RowInsertOptions,
	RowUpdateOptions,
	RowDeleteOptions,
	ErrorCode,
} from "../index";

describe("Module Exports", () => {
	it("should export ProviderRegistry singleton", () => {
		expect(ProviderRegistry).toBeDefined();
		expect(typeof ProviderRegistry.register).toBe("function");
		expect(typeof ProviderRegistry.getRegistration).toBe("function");
	});

	it("should export ProviderRegistryClass for testing", () => {
		expect(ProviderRegistryClass).toBeDefined();
		const instance = new ProviderRegistryClass();
		expect(instance).toBeInstanceOf(ProviderRegistryClass);
	});

	it("should export envelope creation utilities", () => {
		expect(typeof createSuccessEnvelope).toBe("function");
		expect(typeof createErrorEnvelope).toBe("function");
		expect(typeof createMeta).toBe("function");
		expect(typeof withEnvelope).toBe("function");
	});

	it("should export envelope validation utilities", () => {
		expect(typeof isSuccess).toBe("function");
		expect(typeof isError).toBe("function");
		expect(typeof getFirstError).toBe("function");
		expect(typeof unwrap).toBe("function");
	});

	it("should export error utilities", () => {
		expect(ErrorCodes).toBeDefined();
		expect(typeof createProviderError).toBe("function");
	});

	it("should have standard error codes", () => {
		expect(ErrorCodes.CONNECTION_FAILED).toBeDefined();
		expect(ErrorCodes.QUERY_FAILED).toBeDefined();
		expect(ErrorCodes.PROVIDER_ERROR).toBeDefined();
		expect(ErrorCodes.CAPABILITY_NOT_SUPPORTED).toBeDefined();
	});

	// Type-level tests (compile-time verification)
	it("should have valid types (compile-time check)", () => {
		// These type annotations verify the types are exported correctly
		const capability: DbCapability = "connection.test";
		const providerType: ProviderType = "postgres";
		const operator: FilterOperator = "=";

		expect(capability).toBe("connection.test");
		expect(providerType).toBe("postgres");
		expect(operator).toBe("=");
	});

	it("should have envelope type structure", () => {
		const envelope: DbProviderEnvelope<string> = {
			data: "test",
			meta: {
				timestamp: Date.now(),
				provider: "test",
				version: "1.0.0",
			},
			errors: [],
		};

		expect(envelope.data).toBe("test");
		expect(envelope.errors).toHaveLength(0);
	});

	it("should have capability map structure", () => {
		const capInfo: CapabilityInfo = {
			capability: "data.select",
			supported: true,
			version: "1.0.0",
		};

		expect(capInfo.supported).toBe(true);
	});
});
