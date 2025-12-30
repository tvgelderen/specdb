import type { PoolClient } from "pg";
import type { DbProvider } from "~/providers/db-provider/interface";
import {
	createSuccessEnvelope,
	createErrorEnvelope,
	withEnvelope,
	ErrorCodes,
	createProviderError,
} from "~/providers/db-provider/envelope";
import type {
	CapabilityMap,
	CapabilityInfo,
	DbCapability,
	DbProviderEnvelope,
	ProviderStatus,
	ColumnInfo as CommonColumnInfo,
	ConstraintInfo as CommonConstraintInfo,
	DatabaseInfo as CommonDatabaseInfo,
	IndexInfo as CommonIndexInfo,
	QueryResult as CommonQueryResult,
	SchemaInfo as CommonSchemaInfo,
	TableInfo as CommonTableInfo,
	TableStructure as CommonTableStructure,
	RowQueryOptions as CommonRowQueryOptions,
	RowInsertOptions as CommonRowInsertOptions,
	RowUpdateOptions as CommonRowUpdateOptions,
	RowDeleteOptions as CommonRowDeleteOptions,
} from "~/providers/db-provider/types";
import { PostgresProvider } from "./provider";
import type { PostgresConnectionConfig } from "./types";

const PROVIDER_VERSION = "1.0.0";

/**
 * PostgreSQL provider capabilities
 */
const POSTGRES_CAPABILITIES: DbCapability[] = [
	"connection.test",
	"connection.pool",
	"metadata.databases",
	"metadata.schemas",
	"metadata.tables",
	"metadata.columns",
	"metadata.indexes",
	"metadata.constraints",
	"metadata.tableStructure",
	"data.select",
	"data.insert",
	"data.update",
	"data.delete",
	"data.rawQuery",
	"transaction.basic",
	"transaction.savepoints",
	"transaction.isolation",
	"feature.explain",
];

/**
 * Adapter that wraps the existing PostgresProvider to implement the DbProvider interface.
 * This provides the standard envelope response format and capability detection.
 */
export class PostgresDbProviderAdapter implements DbProvider<PostgresConnectionConfig> {
	readonly type = "postgres" as const;
	readonly version = PROVIDER_VERSION;

	private provider: PostgresProvider;
	private config: PostgresConnectionConfig;
	private capabilityMap: CapabilityMap;

	constructor(config: PostgresConnectionConfig) {
		this.config = config;
		this.provider = new PostgresProvider(config);
		this.capabilityMap = this.buildCapabilityMap();
	}

	getConfig(): PostgresConnectionConfig {
		return { ...this.config };
	}

	private buildCapabilityMap(): CapabilityMap {
		const capabilities: Record<DbCapability, CapabilityInfo> = {} as Record<
			DbCapability,
			CapabilityInfo
		>;

		for (const cap of POSTGRES_CAPABILITIES) {
			capabilities[cap] = {
				capability: cap,
				supported: true,
				version: PROVIDER_VERSION,
			};
		}

		// Add unsupported capabilities with supported: false
		const allCapabilities: DbCapability[] = [
			"connection.test",
			"connection.pool",
			"metadata.databases",
			"metadata.schemas",
			"metadata.tables",
			"metadata.columns",
			"metadata.indexes",
			"metadata.constraints",
			"metadata.tableStructure",
			"data.select",
			"data.insert",
			"data.update",
			"data.delete",
			"data.rawQuery",
			"transaction.basic",
			"transaction.savepoints",
			"transaction.isolation",
			"feature.streaming",
			"feature.bulkOperations",
			"feature.explain",
			"feature.notifications",
		];

		for (const cap of allCapabilities) {
			if (!capabilities[cap]) {
				capabilities[cap] = {
					capability: cap,
					supported: false,
					notes: "Not yet implemented for PostgreSQL provider",
				};
			}
		}

		return {
			provider: "postgres",
			version: PROVIDER_VERSION,
			capabilities,
		};
	}

	getCapabilities(): CapabilityMap {
		return this.capabilityMap;
	}

	hasCapability(capability: string): boolean {
		const cap = this.capabilityMap.capabilities[capability as DbCapability];
		return cap?.supported ?? false;
	}

	async connect(): Promise<DbProviderEnvelope<void>> {
		return withEnvelope(async () => {
			await this.provider.connect();
		}, this.type, this.version);
	}

	async disconnect(): Promise<DbProviderEnvelope<void>> {
		return withEnvelope(async () => {
			await this.provider.disconnect();
		}, this.type, this.version);
	}

	async testConnection(): Promise<DbProviderEnvelope<{ success: boolean; message: string }>> {
		const start = performance.now();
		try {
			await this.provider.connect();
			const duration = performance.now() - start;
			return createSuccessEnvelope(
				{ success: true, message: "Connection successful" },
				this.type,
				this.version,
				duration
			);
		} catch (error) {
			const duration = performance.now() - start;
			const message = error instanceof Error ? error.message : "Unknown error";
			return createSuccessEnvelope(
				{ success: false, message },
				this.type,
				this.version,
				duration
			);
		}
	}

	async getStatus(): Promise<DbProviderEnvelope<ProviderStatus>> {
		return withEnvelope(async () => {
			// Since we can't directly access pool stats, we'll return a basic status
			return {
				connected: true,
				lastActivity: Date.now(),
			};
		}, this.type, this.version);
	}

	async listDatabases(): Promise<DbProviderEnvelope<CommonDatabaseInfo[]>> {
		return withEnvelope(async () => {
			const result = await this.provider.listDatabases();
			return result.map((db) => ({
				name: db.name,
				owner: db.owner,
				encoding: db.encoding,
				size: db.size,
				tablespace: db.tablespace,
			}));
		}, this.type, this.version);
	}

	async listSchemas(): Promise<DbProviderEnvelope<CommonSchemaInfo[]>> {
		return withEnvelope(async () => {
			const result = await this.provider.listSchemas();
			return result.map((schema) => ({
				name: schema.name,
				owner: schema.owner,
			}));
		}, this.type, this.version);
	}

	async listTables(schema?: string): Promise<DbProviderEnvelope<CommonTableInfo[]>> {
		return withEnvelope(async () => {
			const result = await this.provider.listTables(schema);
			return result.map((table) => ({
				name: table.name,
				schema: table.schema,
				type: table.type,
				owner: table.owner,
				rowCount: table.rowCount,
				size: table.size,
			}));
		}, this.type, this.version);
	}

	async getColumns(
		schema: string,
		table: string
	): Promise<DbProviderEnvelope<CommonColumnInfo[]>> {
		return withEnvelope(async () => {
			const result = await this.provider.getColumns(schema, table);
			return result.map((col) => ({
				name: col.name,
				dataType: col.dataType,
				isNullable: col.isNullable,
				defaultValue: col.defaultValue,
				isPrimaryKey: col.isPrimaryKey,
				isForeignKey: col.isForeignKey,
				characterMaxLength: col.characterMaxLength,
				numericPrecision: col.numericPrecision,
				numericScale: col.numericScale,
				ordinalPosition: col.ordinalPosition,
			}));
		}, this.type, this.version);
	}

	async getIndexes(
		schema: string,
		table: string
	): Promise<DbProviderEnvelope<CommonIndexInfo[]>> {
		return withEnvelope(async () => {
			const result = await this.provider.getIndexes(schema, table);
			return result.map((idx) => ({
				name: idx.name,
				tableName: idx.tableName,
				columns: idx.columns,
				isUnique: idx.isUnique,
				isPrimary: idx.isPrimary,
				indexType: idx.indexType,
				definition: idx.definition,
			}));
		}, this.type, this.version);
	}

	async getConstraints(
		schema: string,
		table: string
	): Promise<DbProviderEnvelope<CommonConstraintInfo[]>> {
		return withEnvelope(async () => {
			const result = await this.provider.getConstraints(schema, table);
			return result.map((constraint) => ({
				name: constraint.name,
				type: constraint.type,
				tableName: constraint.tableName,
				columns: constraint.columns,
				definition: constraint.definition,
				referencedTable: constraint.referencedTable,
				referencedColumns: constraint.referencedColumns,
				updateRule: constraint.updateRule,
				deleteRule: constraint.deleteRule,
				checkClause: constraint.checkClause,
			}));
		}, this.type, this.version);
	}

	async getTableStructure(
		schema: string,
		table: string
	): Promise<DbProviderEnvelope<CommonTableStructure>> {
		return withEnvelope(async () => {
			const result = await this.provider.getTableStructure(schema, table);
			return {
				tableName: result.tableName,
				schema: result.schema,
				columns: result.columns,
				indexes: result.indexes,
				constraints: result.constraints,
			};
		}, this.type, this.version);
	}

	async selectRows(options: CommonRowQueryOptions): Promise<DbProviderEnvelope<CommonQueryResult>> {
		return withEnvelope(async () => {
			const result = await this.provider.selectRows({
				schema: options.schema,
				table: options.table,
				columns: options.columns,
				filters: options.filters,
				orderBy: options.orderBy,
				limit: options.limit,
				offset: options.offset,
			});
			return {
				rows: result.rows,
				rowCount: result.rowCount,
				fields: result.fields,
			};
		}, this.type, this.version);
	}

	async insertRow(options: CommonRowInsertOptions): Promise<DbProviderEnvelope<CommonQueryResult>> {
		return withEnvelope(async () => {
			const result = await this.provider.insertRow({
				schema: options.schema,
				table: options.table,
				data: options.data,
			});
			return {
				rows: result.rows,
				rowCount: result.rowCount,
				fields: result.fields,
			};
		}, this.type, this.version);
	}

	async updateRows(options: CommonRowUpdateOptions): Promise<DbProviderEnvelope<CommonQueryResult>> {
		return withEnvelope(async () => {
			const result = await this.provider.updateRows({
				schema: options.schema,
				table: options.table,
				data: options.data,
				where: options.where,
			});
			return {
				rows: result.rows,
				rowCount: result.rowCount,
				fields: result.fields,
			};
		}, this.type, this.version);
	}

	async deleteRows(options: CommonRowDeleteOptions): Promise<DbProviderEnvelope<CommonQueryResult>> {
		return withEnvelope(async () => {
			const result = await this.provider.deleteRows({
				schema: options.schema,
				table: options.table,
				where: options.where,
			});
			return {
				rows: result.rows,
				rowCount: result.rowCount,
				fields: result.fields,
			};
		}, this.type, this.version);
	}

	async executeQuery(
		sql: string,
		params: unknown[] = []
	): Promise<DbProviderEnvelope<CommonQueryResult>> {
		return withEnvelope(async () => {
			const result = await this.provider.executeQuery(sql, params);
			return {
				rows: result.rows,
				rowCount: result.rowCount,
				fields: result.fields,
			};
		}, this.type, this.version);
	}

	async transaction<T>(
		callback: (client: unknown) => Promise<T>,
		maxRetries: number = 3
	): Promise<DbProviderEnvelope<T>> {
		const start = performance.now();
		try {
			const result = await this.provider.transaction(
				callback as (client: PoolClient) => Promise<T>,
				maxRetries
			);
			const duration = performance.now() - start;
			return createSuccessEnvelope(result, this.type, this.version, duration);
		} catch (error) {
			const duration = performance.now() - start;
			return createErrorEnvelope<T>(error as Error, this.type, this.version, duration);
		}
	}

	/**
	 * Get the underlying PostgresProvider for direct access if needed
	 */
	getUnderlyingProvider(): PostgresProvider {
		return this.provider;
	}
}
