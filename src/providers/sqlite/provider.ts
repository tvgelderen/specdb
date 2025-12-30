import Database, { type Database as DatabaseType, type Statement } from "better-sqlite3";
import { statSync } from "node:fs";
import logger from "~/lib/logging";
import type {
	SqliteConnectionConfig,
	DatabaseInfo,
	SchemaInfo,
	TableInfo,
	ColumnInfo,
	IndexInfo,
	ConstraintInfo,
	TableStructure,
	QueryResult,
	RowQueryOptions,
	RowCountOptions,
	RowInsertOptions,
	RowUpdateOptions,
	RowDeleteOptions,
	RowFilter,
} from "./types";
import { DEFAULT_QUERY_TIMEOUT_MS } from "./types";

/**
 * Pagination options for list methods
 */
export interface PaginationOptions {
	limit: number;
	offset: number;
}

/**
 * Paginated result with total count
 */
export interface PaginatedResult<T> {
	items: T[];
	total: number;
	offset: number;
	limit: number;
	hasMore: boolean;
}

/**
 * Quote an identifier (table/column name) for SQLite
 */
function quoteIdentifier(identifier: string): string {
	return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Build WHERE clause from filters
 * SQLite uses ? as parameter placeholder instead of $1, $2, etc.
 */
function buildWhereClause(
	filters: RowFilter[]
): { clause: string; values: unknown[] } {
	if (filters.length === 0) {
		return { clause: "", values: [] };
	}

	const conditions: string[] = [];
	const values: unknown[] = [];

	for (const filter of filters) {
		const quotedColumn = quoteIdentifier(filter.column);

		switch (filter.operator) {
			case "IS NULL":
				conditions.push(`${quotedColumn} IS NULL`);
				break;
			case "IS NOT NULL":
				conditions.push(`${quotedColumn} IS NOT NULL`);
				break;
			case "IN":
				if (Array.isArray(filter.value)) {
					const placeholders = filter.value.map(() => "?").join(", ");
					conditions.push(`${quotedColumn} IN (${placeholders})`);
					values.push(...filter.value);
				}
				break;
			case "ILIKE":
				// SQLite doesn't support ILIKE, use LIKE with LOWER for case-insensitive matching
				conditions.push(`LOWER(${quotedColumn}) LIKE LOWER(?)`);
				values.push(filter.value);
				break;
			default:
				conditions.push(`${quotedColumn} ${filter.operator} ?`);
				values.push(filter.value);
		}
	}

	return {
		clause: `WHERE ${conditions.join(" AND ")}`,
		values,
	};
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export class SqliteProvider {
	private db: DatabaseType | null = null;
	private config: SqliteConnectionConfig;

	constructor(config: SqliteConnectionConfig) {
		this.config = config;
	}

	async connect(): Promise<void> {
		if (this.db) {
			return;
		}

		try {
			this.db = new Database(this.config.filepath, {
				readonly: this.config.readonly ?? false,
				timeout: this.config.timeout ?? 5000,
				fileMustExist: this.config.fileMustExist ?? false,
			});

			// Enable WAL mode for better concurrent access (unless explicitly disabled)
			if (this.config.enableWAL !== false) {
				this.db.pragma("journal_mode = WAL");
			}

			// Enable foreign key constraints (unless explicitly disabled)
			if (this.config.enableForeignKeys !== false) {
				this.db.pragma("foreign_keys = ON");
			}

			logger.info(`[SqliteProvider] Connected to ${this.config.filepath}`);
		} catch (error) {
			logger.error("[SqliteProvider] Connection failed:", error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (this.db) {
			this.db.close();
			this.db = null;
			logger.info("[SqliteProvider] Connection closed");
		}
	}

	private ensureConnected(): DatabaseType {
		if (!this.db) {
			throw new Error("Database not connected. Call connect() first.");
		}
		return this.db;
	}

	private query<T = Record<string, unknown>>(
		sql: string,
		params: unknown[] = []
	): QueryResult<T> {
		const db = this.ensureConnected();
		const dbStartTime = performance.now();

		try {
			const stmt = db.prepare(sql);

			// Check if this is a SELECT query or a query that returns rows
			const sqlUpper = sql.trim().toUpperCase();
			const isSelect = sqlUpper.startsWith("SELECT") ||
				sqlUpper.startsWith("PRAGMA") ||
				sqlUpper.includes("RETURNING");

			if (isSelect) {
				const rows = stmt.all(...params) as T[];
				const dbMs = Math.round(performance.now() - dbStartTime);

				// Get column info from the statement
				const columns = stmt.columns();
				const fields = columns.map((col) => ({
					name: col.name,
					dataType: col.type || "unknown",
				}));

				return {
					rows,
					rowCount: rows.length,
					fields,
					timing: {
						totalMs: 0,
						dbMs,
					},
				};
			} else {
				// For INSERT, UPDATE, DELETE without RETURNING
				const result = stmt.run(...params);
				const dbMs = Math.round(performance.now() - dbStartTime);

				return {
					rows: [] as T[],
					rowCount: result.changes,
					fields: [],
					timing: {
						totalMs: 0,
						dbMs,
					},
				};
			}
		} catch (error) {
			logger.error("[SqliteProvider] Query failed:", { sql, error });
			throw error;
		}
	}

	async listDatabases(): Promise<DatabaseInfo[]> {
		// SQLite files contain a single database
		// We return the main database info
		const filepath = this.config.filepath;
		let size = "0 B";

		try {
			const stats = statSync(filepath);
			size = formatBytes(stats.size);
		} catch {
			// File might not exist yet
		}

		// Get the database name from the file path
		const name = filepath.split("/").pop()?.replace(/\.db$/, "") ?? "main";

		return [
			{
				name,
				filepath,
				size,
			},
		];
	}

	/**
	 * List databases with pagination (SQLite only has one database per file)
	 */
	async listDatabasesPaginated(pagination: PaginationOptions): Promise<PaginatedResult<DatabaseInfo>> {
		const databases = await this.listDatabases();
		const total = databases.length;
		const items = databases.slice(pagination.offset, pagination.offset + pagination.limit);

		return {
			items,
			total,
			offset: pagination.offset,
			limit: pagination.limit,
			hasMore: pagination.offset + pagination.limit < total,
		};
	}

	async listSchemas(): Promise<SchemaInfo[]> {
		// SQLite doesn't have traditional schemas, but it has attached databases
		// The main schema is always "main"
		const db = this.ensureConnected();

		const result = db.prepare("PRAGMA database_list").all() as Array<{
			seq: number;
			name: string;
			file: string;
		}>;

		return result.map((row) => ({
			name: row.name,
		}));
	}

	/**
	 * List schemas with pagination
	 */
	async listSchemasPaginated(pagination: PaginationOptions, _database?: string): Promise<PaginatedResult<SchemaInfo & { owner: string; database: string }>> {
		const schemas = await this.listSchemas();
		const total = schemas.length;

		// Get the database name from the file path
		const databaseName = this.config.filepath.split("/").pop()?.replace(/\.(db|sqlite|sqlite3)$/i, "") ?? "main";

		const items = schemas
			.slice(pagination.offset, pagination.offset + pagination.limit)
			.map((schema) => ({
				...schema,
				owner: "", // SQLite doesn't have owners
				database: databaseName,
			}));

		return {
			items,
			total,
			offset: pagination.offset,
			limit: pagination.limit,
			hasMore: pagination.offset + pagination.limit < total,
		};
	}

	async listTables(schema: string = "main"): Promise<TableInfo[]> {
		const db = this.ensureConnected();

		// Query sqlite_master for tables and views
		const stmt = db.prepare(`
			SELECT
				name,
				type
			FROM ${quoteIdentifier(schema)}.sqlite_master
			WHERE type IN ('table', 'view')
				AND name NOT LIKE 'sqlite_%'
			ORDER BY name
		`);

		const tables = stmt.all() as Array<{ name: string; type: string }>;

		// Get row counts for each table
		const result: TableInfo[] = [];
		for (const table of tables) {
			let rowCount: number | null = null;

			if (table.type === "table") {
				try {
					const countResult = db
						.prepare(`SELECT COUNT(*) as count FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table.name)}`)
						.get() as { count: number };
					rowCount = countResult.count;
				} catch {
					// Table might be empty or have issues
				}
			}

			result.push({
				name: table.name,
				schema,
				type: table.type as "table" | "view",
				rowCount,
			});
		}

		return result;
	}

	/**
	 * List tables with pagination
	 */
	async listTablesPaginated(schema: string, pagination: PaginationOptions): Promise<PaginatedResult<TableInfo & { owner: string; size: string }>> {
		const tables = await this.listTables(schema);
		const total = tables.length;

		const items = tables
			.slice(pagination.offset, pagination.offset + pagination.limit)
			.map((table) => ({
				...table,
				owner: "", // SQLite doesn't have owners
				size: "", // SQLite doesn't track per-table size
			}));

		return {
			items,
			total,
			offset: pagination.offset,
			limit: pagination.limit,
			hasMore: pagination.offset + pagination.limit < total,
		};
	}

	async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
		const db = this.ensureConnected();

		// Get column info using PRAGMA
		const columns = db
			.prepare(`PRAGMA ${quoteIdentifier(schema)}.table_info(${quoteIdentifier(table)})`)
			.all() as Array<{
			cid: number;
			name: string;
			type: string;
			notnull: number;
			dflt_value: string | null;
			pk: number;
		}>;

		// Get foreign key info
		const foreignKeys = db
			.prepare(`PRAGMA ${quoteIdentifier(schema)}.foreign_key_list(${quoteIdentifier(table)})`)
			.all() as Array<{
			id: number;
			seq: number;
			table: string;
			from: string;
			to: string;
		}>;

		const fkColumns = new Set(foreignKeys.map((fk) => fk.from));

		return columns.map((col) => ({
			name: col.name,
			dataType: col.type || "unknown",
			isNullable: col.notnull === 0,
			defaultValue: col.dflt_value,
			isPrimaryKey: col.pk > 0,
			isForeignKey: fkColumns.has(col.name),
			ordinalPosition: col.cid + 1,
		}));
	}

	async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
		const db = this.ensureConnected();

		// Get index list
		const indexes = db
			.prepare(`PRAGMA ${quoteIdentifier(schema)}.index_list(${quoteIdentifier(table)})`)
			.all() as Array<{
			seq: number;
			name: string;
			unique: number;
			origin: string;
			partial: number;
		}>;

		const result: IndexInfo[] = [];

		for (const idx of indexes) {
			// Get columns for this index
			const indexInfo = db
				.prepare(`PRAGMA ${quoteIdentifier(schema)}.index_info(${quoteIdentifier(idx.name)})`)
				.all() as Array<{
				seqno: number;
				cid: number;
				name: string;
			}>;

			const columns = indexInfo
				.sort((a, b) => a.seqno - b.seqno)
				.map((col) => col.name);

			// Get the SQL definition
			const sqlResult = db
				.prepare(`
					SELECT sql FROM ${quoteIdentifier(schema)}.sqlite_master
					WHERE type = 'index' AND name = ?
				`)
				.get(idx.name) as { sql: string | null } | undefined;

			result.push({
				name: idx.name,
				tableName: table,
				columns,
				isUnique: idx.unique === 1,
				isPrimary: idx.origin === "pk",
				definition: sqlResult?.sql ?? "",
			});
		}

		return result;
	}

	async getConstraints(schema: string, table: string): Promise<ConstraintInfo[]> {
		const db = this.ensureConnected();
		const result: ConstraintInfo[] = [];

		// Get primary key info
		const columns = db
			.prepare(`PRAGMA ${quoteIdentifier(schema)}.table_info(${quoteIdentifier(table)})`)
			.all() as Array<{
			cid: number;
			name: string;
			pk: number;
		}>;

		const pkColumns = columns
			.filter((col) => col.pk > 0)
			.sort((a, b) => a.pk - b.pk)
			.map((col) => col.name);

		if (pkColumns.length > 0) {
			result.push({
				name: `${table}_pkey`,
				type: "PRIMARY KEY",
				tableName: table,
				columns: pkColumns,
				definition: `PRIMARY KEY (${pkColumns.map(quoteIdentifier).join(", ")})`,
			});
		}

		// Get foreign keys
		const foreignKeys = db
			.prepare(`PRAGMA ${quoteIdentifier(schema)}.foreign_key_list(${quoteIdentifier(table)})`)
			.all() as Array<{
			id: number;
			seq: number;
			table: string;
			from: string;
			to: string;
			on_update: string;
			on_delete: string;
		}>;

		// Group foreign keys by id
		const fkGroups = new Map<number, typeof foreignKeys>();
		for (const fk of foreignKeys) {
			if (!fkGroups.has(fk.id)) {
				fkGroups.set(fk.id, []);
			}
			fkGroups.get(fk.id)!.push(fk);
		}

		for (const [id, fks] of fkGroups) {
			const sorted = fks.sort((a, b) => a.seq - b.seq);
			const fromCols = sorted.map((fk) => fk.from);
			const toCols = sorted.map((fk) => fk.to);
			const refTable = sorted[0].table;

			result.push({
				name: `${table}_fk_${id}`,
				type: "FOREIGN KEY",
				tableName: table,
				columns: fromCols,
				referencedTable: refTable,
				referencedColumns: toCols,
				definition: `FOREIGN KEY (${fromCols.map(quoteIdentifier).join(", ")}) REFERENCES ${quoteIdentifier(refTable)} (${toCols.map(quoteIdentifier).join(", ")})`,
			});
		}

		// Get unique constraints from indexes
		const indexes = db
			.prepare(`PRAGMA ${quoteIdentifier(schema)}.index_list(${quoteIdentifier(table)})`)
			.all() as Array<{
			seq: number;
			name: string;
			unique: number;
			origin: string;
		}>;

		for (const idx of indexes) {
			if (idx.unique === 1 && idx.origin !== "pk") {
				const indexInfo = db
					.prepare(`PRAGMA ${quoteIdentifier(schema)}.index_info(${quoteIdentifier(idx.name)})`)
					.all() as Array<{
					seqno: number;
					name: string;
				}>;

				const cols = indexInfo
					.sort((a, b) => a.seqno - b.seqno)
					.map((col) => col.name);

				result.push({
					name: idx.name,
					type: "UNIQUE",
					tableName: table,
					columns: cols,
					definition: `UNIQUE (${cols.map(quoteIdentifier).join(", ")})`,
				});
			}
		}

		return result;
	}

	async getTableStructure(schema: string, table: string): Promise<TableStructure> {
		const [columns, indexes, constraints] = await Promise.all([
			this.getColumns(schema, table),
			this.getIndexes(schema, table),
			this.getConstraints(schema, table),
		]);

		return {
			tableName: table,
			schema,
			columns,
			indexes,
			constraints,
		};
	}

	async selectRows(options: RowQueryOptions): Promise<QueryResult> {
		const schema = options.schema ?? "main";
		const columns = options.columns?.map(quoteIdentifier).join(", ") ?? "*";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		let sql = `SELECT ${columns} FROM ${tableName}`;
		const values: unknown[] = [];

		if (options.filters && options.filters.length > 0) {
			const whereResult = buildWhereClause(options.filters);
			sql += ` ${whereResult.clause}`;
			values.push(...whereResult.values);
		}

		if (options.orderBy && options.orderBy.length > 0) {
			const orderClauses = options.orderBy.map(
				(o) => `${quoteIdentifier(o.column)} ${o.direction}`
			);
			sql += ` ORDER BY ${orderClauses.join(", ")}`;
		}

		if (options.limit !== undefined) {
			sql += ` LIMIT ?`;
			values.push(options.limit);
		}

		if (options.offset !== undefined) {
			sql += ` OFFSET ?`;
			values.push(options.offset);
		}

		return this.query(sql, values);
	}

	async countRows(options: RowCountOptions): Promise<{ count: number }> {
		const schema = options.schema ?? "main";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
		const values: unknown[] = [];

		if (options.filters && options.filters.length > 0) {
			const whereResult = buildWhereClause(options.filters);
			sql += ` ${whereResult.clause}`;
			values.push(...whereResult.values);
		}

		const result = this.query<{ count: number }>(sql, values);
		return { count: result.rows[0]?.count ?? 0 };
	}

	async insertRow(options: RowInsertOptions): Promise<QueryResult> {
		const schema = options.schema ?? "main";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		const columns = Object.keys(options.data);
		const quotedColumns = columns.map(quoteIdentifier).join(", ");
		const placeholders = columns.map(() => "?").join(", ");
		const values = columns.map((col) => options.data[col]);

		// SQLite supports RETURNING clause in version 3.35.0+
		const sql = `INSERT INTO ${tableName} (${quotedColumns}) VALUES (${placeholders}) RETURNING *`;

		return this.query(sql, values);
	}

	async updateRows(options: RowUpdateOptions): Promise<QueryResult> {
		const schema = options.schema ?? "main";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		const columns = Object.keys(options.data);
		const setClauses = columns.map((col) => `${quoteIdentifier(col)} = ?`);
		const values = columns.map((col) => options.data[col]);

		const whereResult = buildWhereClause(options.where);
		values.push(...whereResult.values);

		const sql = `UPDATE ${tableName} SET ${setClauses.join(", ")} ${whereResult.clause} RETURNING *`;

		return this.query(sql, values);
	}

	async deleteRows(options: RowDeleteOptions): Promise<QueryResult> {
		const schema = options.schema ?? "main";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		const whereResult = buildWhereClause(options.where);

		if (whereResult.clause === "") {
			throw new Error("DELETE without WHERE clause is not allowed for safety");
		}

		const sql = `DELETE FROM ${tableName} ${whereResult.clause} RETURNING *`;

		return this.query(sql, whereResult.values);
	}

	async executeQuery(sql: string, params: unknown[] = []): Promise<QueryResult> {
		return this.query(sql, params);
	}

	/**
	 * Execute multiple statements within a transaction
	 */
	async transaction<T>(
		callback: (db: DatabaseType) => T,
		_maxRetries: number = 3
	): Promise<T> {
		const db = this.ensureConnected();

		return db.transaction(() => {
			return callback(db);
		})();
	}

	/**
	 * Get SQLite version info
	 */
	async getVersion(): Promise<string> {
		const db = this.ensureConnected();
		const result = db.prepare("SELECT sqlite_version() as version").get() as { version: string };
		return result.version;
	}

	/**
	 * Get database file size
	 */
	async getFileSize(): Promise<string> {
		try {
			const stats = statSync(this.config.filepath);
			return formatBytes(stats.size);
		} catch {
			return "0 B";
		}
	}

	/**
	 * Run VACUUM to optimize database
	 */
	async vacuum(): Promise<void> {
		const db = this.ensureConnected();
		db.exec("VACUUM");
		logger.info("[SqliteProvider] VACUUM completed");
	}

	/**
	 * Run integrity check
	 */
	async integrityCheck(): Promise<{ ok: boolean; message: string }> {
		const db = this.ensureConnected();
		const result = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
		const isOk = result.integrity_check === "ok";
		return {
			ok: isOk,
			message: result.integrity_check,
		};
	}
}
