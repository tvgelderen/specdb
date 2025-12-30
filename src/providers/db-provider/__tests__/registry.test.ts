import { describe, it, expect, beforeEach } from "bun:test";
import { ProviderRegistryClass } from "../registry";
import type { ProviderRegistration, DbCapability, CapabilityMap, DbProviderEnvelope, ProviderStatus } from "../types";
import type { DbProvider } from "../interface";

// Mock provider for testing
class MockProvider implements DbProvider {
	readonly type = "postgres" as const;
	readonly version = "1.0.0";
	private config: { host: string };
	private connected = false;

	constructor(config: { host: string }) {
		this.config = config;
	}

	getConfig() {
		return this.config;
	}

	async connect(): Promise<DbProviderEnvelope<void>> {
		this.connected = true;
		return {
			data: undefined,
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async disconnect(): Promise<DbProviderEnvelope<void>> {
		this.connected = false;
		return {
			data: undefined,
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async testConnection(): Promise<DbProviderEnvelope<{ success: boolean; message: string }>> {
		return {
			data: { success: true, message: "OK" },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async getStatus(): Promise<DbProviderEnvelope<ProviderStatus>> {
		return {
			data: { connected: this.connected },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	getCapabilities(): CapabilityMap {
		return {
			provider: "postgres",
			version: "1.0.0",
			capabilities: {} as CapabilityMap["capabilities"],
		};
	}

	hasCapability(_capability: string): boolean {
		return false;
	}

	async listDatabases() {
		return { data: [], meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" }, errors: [] };
	}

	async listSchemas() {
		return { data: [], meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" }, errors: [] };
	}

	async listTables() {
		return { data: [], meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" }, errors: [] };
	}

	async getColumns() {
		return { data: [], meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" }, errors: [] };
	}

	async getIndexes() {
		return { data: [], meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" }, errors: [] };
	}

	async getConstraints() {
		return { data: [], meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" }, errors: [] };
	}

	async getTableStructure() {
		return {
			data: { tableName: "", schema: "", columns: [], indexes: [], constraints: [] },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async selectRows() {
		return {
			data: { rows: [], rowCount: 0, fields: [] },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async insertRow() {
		return {
			data: { rows: [], rowCount: 0, fields: [] },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async updateRows() {
		return {
			data: { rows: [], rowCount: 0, fields: [] },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async deleteRows() {
		return {
			data: { rows: [], rowCount: 0, fields: [] },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async executeQuery() {
		return {
			data: { rows: [], rowCount: 0, fields: [] },
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}

	async transaction<T>(callback: (client: unknown) => Promise<T>): Promise<DbProviderEnvelope<T>> {
		const result = await callback({});
		return {
			data: result,
			meta: { timestamp: Date.now(), provider: "postgres", version: "1.0.0" },
			errors: [],
		};
	}
}

describe("ProviderRegistry", () => {
	let registry: ProviderRegistryClass;

	const mockRegistration: ProviderRegistration<{ host: string }> = {
		type: "postgres",
		name: "PostgreSQL",
		description: "PostgreSQL database provider",
		version: "1.0.0",
		capabilities: [
			"connection.test",
			"metadata.databases",
			"metadata.schemas",
			"data.select",
		] as DbCapability[],
		factory: (config: { host: string }) => new MockProvider(config),
	};

	beforeEach(async () => {
		registry = new ProviderRegistryClass();
	});

	describe("register", () => {
		it("should register a provider", () => {
			registry.register(mockRegistration);
			expect(registry.isRegistered("postgres")).toBe(true);
		});

		it("should allow overwriting a registration", () => {
			registry.register(mockRegistration);
			const updated = { ...mockRegistration, version: "2.0.0" };
			registry.register(updated);
			expect(registry.getRegistration("postgres")?.version).toBe("2.0.0");
		});
	});

	describe("unregister", () => {
		it("should unregister a provider", () => {
			registry.register(mockRegistration);
			expect(registry.unregister("postgres")).toBe(true);
			expect(registry.isRegistered("postgres")).toBe(false);
		});

		it("should return false for non-existent provider", () => {
			expect(registry.unregister("mysql")).toBe(false);
		});
	});

	describe("getRegistration", () => {
		it("should return registration for registered provider", () => {
			registry.register(mockRegistration);
			const registration = registry.getRegistration("postgres");
			expect(registration).toBeDefined();
			expect(registration?.name).toBe("PostgreSQL");
		});

		it("should return undefined for non-existent provider", () => {
			expect(registry.getRegistration("mysql")).toBeUndefined();
		});
	});

	describe("getAllRegistrations", () => {
		it("should return all registrations", () => {
			registry.register(mockRegistration);
			const all = registry.getAllRegistrations();
			expect(all).toHaveLength(1);
			expect(all[0].type).toBe("postgres");
		});
	});

	describe("getProviderTypes", () => {
		it("should return all provider types", () => {
			registry.register(mockRegistration);
			const types = registry.getProviderTypes();
			expect(types).toContain("postgres");
		});
	});

	describe("createProvider", () => {
		it("should create a new provider instance", () => {
			registry.register(mockRegistration);
			const provider = registry.createProvider("postgres", { host: "localhost" });
			expect(provider).toBeDefined();
			expect(provider.type).toBe("postgres");
		});

		it("should throw for non-existent provider type", () => {
			expect(() => registry.createProvider("mysql", {})).toThrow(
				"Provider type 'mysql' is not registered"
			);
		});
	});

	describe("getCapabilitySummary", () => {
		it("should return capability summary", () => {
			registry.register(mockRegistration);
			const summary = registry.getCapabilitySummary();
			expect(summary.postgres).toBeDefined();
			expect(summary.postgres).toContain("connection.test");
			expect(summary.postgres).toContain("data.select");
		});
	});

	describe("findProvidersWithCapabilities", () => {
		it("should find providers with matching capabilities", () => {
			registry.register(mockRegistration);
			const providers = registry.findProvidersWithCapabilities(["data.select"]);
			expect(providers).toHaveLength(1);
			expect(providers[0].type).toBe("postgres");
		});

		it("should return empty for non-matching capabilities", () => {
			registry.register(mockRegistration);
			const providers = registry.findProvidersWithCapabilities(["feature.streaming"]);
			expect(providers).toHaveLength(0);
		});
	});
});
