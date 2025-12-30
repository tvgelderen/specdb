import { Pool, type PoolClient, type QueryResult as PgQueryResult } from "pg";
import logger from "~/lib/logging";
import type {
	PostgresConnectionConfig,
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

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replace(/"/g, '""')}"`;
}

function buildWhereClause(
	filters: RowFilter[],
	startParamIndex: number = 1
): { clause: string; values: unknown[] } {
	if (filters.length === 0) {
		return { clause: "", values: [] };
	}

	const conditions: string[] = [];
	const values: unknown[] = [];
	let paramIndex = startParamIndex;

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
					const placeholders = filter.value.map(() => `$${paramIndex++}`).join(", ");
					conditions.push(`${quotedColumn} IN (${placeholders})`);
					values.push(...filter.value);
				}
				break;
			default:
				conditions.push(`${quotedColumn} ${filter.operator} $${paramIndex++}`);
				values.push(filter.value);
		}
	}

	return {
		clause: `WHERE ${conditions.join(" AND ")}`,
		values,
	};
}

export class PostgresProvider {
	private pool: Pool;
	private config: PostgresConnectionConfig;

	constructor(config: PostgresConnectionConfig) {
		this.config = config;
		this.pool = new Pool({
			host: config.host,
			port: config.port,
			user: config.user,
			password: config.password,
			database: config.database,
			ssl: config.ssl,
			max: config.max ?? 10,
			idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
			connectionTimeoutMillis: config.connectionTimeoutMillis ?? 10000,
		});

		this.pool.on("error", (err) => {
			logger.error("[PostgresProvider] Pool error:", err);
		});

		this.pool.on("connect", () => {
			logger.debug("[PostgresProvider] New client connected to pool");
		});
	}

	async connect(): Promise<void> {
		const client = await this.pool.connect();
		try {
			await client.query("SELECT 1");
			logger.info("[PostgresProvider] Connection test successful");
		} finally {
			client.release();
		}
	}

	async disconnect(): Promise<void> {
		await this.pool.end();
		logger.info("[PostgresProvider] Pool closed");
	}

	async getClient(): Promise<PoolClient> {
		return this.pool.connect();
	}

	private async query<T = Record<string, unknown>>(
		sql: string,
		params: unknown[] = [],
		timeoutMs?: number
	): Promise<QueryResult<T>> {
		const client = await this.pool.connect();
		try {
			if (timeoutMs !== undefined) {
				await client.query(`SET statement_timeout = ${timeoutMs}`);
			}
			// Measure database roundtrip time
			const dbStartTime = performance.now();
			const result: PgQueryResult = await client.query(sql, params);
			const dbMs = Math.round(performance.now() - dbStartTime);

			return {
				rows: result.rows as T[],
				rowCount: result.rowCount ?? 0,
				fields: result.fields.map((f) => ({
					name: f.name,
					dataType: f.dataTypeID.toString(),
				})),
				timing: {
					totalMs: 0, // Will be set by the caller/wrapper
					dbMs,
				},
			};
		} finally {
			if (timeoutMs !== undefined) {
				await client.query("RESET statement_timeout").catch(() => {});
			}
			client.release();
		}
	}

	async listDatabases(): Promise<DatabaseInfo[]> {
		const result = await this.query<{
			datname: string;
			owner: string;
			encoding: string;
			size: string;
			tablespace: string;
		}>(`
			SELECT
				d.datname,
				pg_catalog.pg_get_userbyid(d.datdba) as owner,
				pg_catalog.pg_encoding_to_char(d.encoding) as encoding,
				pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(d.datname)) as size,
				t.spcname as tablespace
			FROM pg_catalog.pg_database d
			LEFT JOIN pg_catalog.pg_tablespace t ON d.dattablespace = t.oid
			WHERE d.datistemplate = false
			ORDER BY d.datname
		`);

		return result.rows.map((row) => ({
			name: row.datname,
			owner: row.owner,
			encoding: row.encoding,
			size: row.size,
			tablespace: row.tablespace,
		}));
	}

	async listSchemas(): Promise<SchemaInfo[]> {
		const result = await this.query<{
			schema_name: string;
			owner: string;
		}>(`
			SELECT
				n.nspname as schema_name,
				pg_catalog.pg_get_userbyid(n.nspowner) as owner
			FROM pg_catalog.pg_namespace n
			WHERE n.nspname !~ '^pg_'
				AND n.nspname <> 'information_schema'
			ORDER BY n.nspname
		`);

		return result.rows.map((row) => ({
			name: row.schema_name,
			owner: row.owner,
		}));
	}

	async listTables(schema: string = "public"): Promise<TableInfo[]> {
		const result = await this.query<{
			table_name: string;
			table_schema: string;
			table_type: string;
			owner: string;
			row_count: string | null;
			size: string | null;
		}>(
			`
			SELECT
				c.relname as table_name,
				n.nspname as table_schema,
				CASE c.relkind
					WHEN 'r' THEN 'table'
					WHEN 'v' THEN 'view'
					WHEN 'm' THEN 'materialized_view'
				END as table_type,
				pg_catalog.pg_get_userbyid(c.relowner) as owner,
				c.reltuples::bigint as row_count,
				pg_catalog.pg_size_pretty(pg_catalog.pg_table_size(c.oid)) as size
			FROM pg_catalog.pg_class c
			LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
			WHERE c.relkind IN ('r', 'v', 'm')
				AND n.nspname = $1
				AND n.nspname !~ '^pg_'
				AND n.nspname <> 'information_schema'
			ORDER BY c.relname
		`,
			[schema]
		);

		return result.rows.map((row) => ({
			name: row.table_name,
			schema: row.table_schema,
			type: row.table_type as "table" | "view" | "materialized_view",
			owner: row.owner,
			rowCount: row.row_count ? parseInt(row.row_count, 10) : null,
			size: row.size,
		}));
	}

	async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
		const result = await this.query<{
			column_name: string;
			data_type: string;
			is_nullable: string;
			column_default: string | null;
			is_primary: boolean;
			is_foreign: boolean;
			character_maximum_length: number | null;
			numeric_precision: number | null;
			numeric_scale: number | null;
			ordinal_position: number;
		}>(
			`
			SELECT
				c.column_name,
				c.data_type,
				c.is_nullable,
				c.column_default,
				COALESCE(pk.is_primary, false) as is_primary,
				COALESCE(fk.is_foreign, false) as is_foreign,
				c.character_maximum_length,
				c.numeric_precision,
				c.numeric_scale,
				c.ordinal_position
			FROM information_schema.columns c
			LEFT JOIN (
				SELECT
					kcu.column_name,
					true as is_primary
				FROM information_schema.table_constraints tc
				JOIN information_schema.key_column_usage kcu
					ON tc.constraint_name = kcu.constraint_name
					AND tc.table_schema = kcu.table_schema
				WHERE tc.constraint_type = 'PRIMARY KEY'
					AND tc.table_schema = $1
					AND tc.table_name = $2
			) pk ON c.column_name = pk.column_name
			LEFT JOIN (
				SELECT
					kcu.column_name,
					true as is_foreign
				FROM information_schema.table_constraints tc
				JOIN information_schema.key_column_usage kcu
					ON tc.constraint_name = kcu.constraint_name
					AND tc.table_schema = kcu.table_schema
				WHERE tc.constraint_type = 'FOREIGN KEY'
					AND tc.table_schema = $1
					AND tc.table_name = $2
			) fk ON c.column_name = fk.column_name
			WHERE c.table_schema = $1
				AND c.table_name = $2
			ORDER BY c.ordinal_position
		`,
			[schema, table]
		);

		return result.rows.map((row) => ({
			name: row.column_name,
			dataType: row.data_type,
			isNullable: row.is_nullable === "YES",
			defaultValue: row.column_default,
			isPrimaryKey: row.is_primary,
			isForeignKey: row.is_foreign,
			characterMaxLength: row.character_maximum_length,
			numericPrecision: row.numeric_precision,
			numericScale: row.numeric_scale,
			ordinalPosition: row.ordinal_position,
		}));
	}

	async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
		const result = await this.query<{
			index_name: string;
			table_name: string;
			column_names: string[];
			is_unique: boolean;
			is_primary: boolean;
			index_type: string;
			index_definition: string;
			index_size: string | null;
		}>(
			`
			SELECT
				i.relname as index_name,
				t.relname as table_name,
				array_agg(a.attname ORDER BY x.n) as column_names,
				ix.indisunique as is_unique,
				ix.indisprimary as is_primary,
				am.amname as index_type,
				pg_catalog.pg_get_indexdef(ix.indexrelid, 0, true) as index_definition,
				pg_catalog.pg_size_pretty(pg_catalog.pg_relation_size(i.oid)) as index_size
			FROM pg_catalog.pg_class t
			JOIN pg_catalog.pg_index ix ON t.oid = ix.indrelid
			JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
			JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
			JOIN pg_catalog.pg_am am ON am.oid = i.relam
			CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, n)
			JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
			WHERE n.nspname = $1
				AND t.relname = $2
			GROUP BY i.relname, t.relname, ix.indisunique, ix.indisprimary, am.amname, ix.indexrelid, i.oid
			ORDER BY i.relname
		`,
			[schema, table]
		);

		return result.rows.map((row) => ({
			name: row.index_name,
			tableName: row.table_name,
			columns: row.column_names,
			isUnique: row.is_unique,
			isPrimary: row.is_primary,
			indexType: row.index_type,
			definition: row.index_definition,
			size: row.index_size,
		}));
	}

	async getConstraints(schema: string, table: string): Promise<ConstraintInfo[]> {
		const result = await this.query<{
			constraint_name: string;
			constraint_type: string;
			table_name: string;
			column_names: string[];
			constraint_definition: string;
			referenced_table: string | null;
			referenced_columns: string[] | null;
			update_rule: string | null;
			delete_rule: string | null;
			check_clause: string | null;
		}>(
			`
			SELECT
				tc.constraint_name,
				tc.constraint_type,
				tc.table_name,
				array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as column_names,
				pg_catalog.pg_get_constraintdef(pgc.oid, true) as constraint_definition,
				ccu.table_name as referenced_table,
				array_agg(DISTINCT ccu.column_name) FILTER (WHERE ccu.column_name IS NOT NULL) as referenced_columns,
				rc.update_rule,
				rc.delete_rule,
				cc.check_clause
			FROM information_schema.table_constraints tc
			JOIN pg_catalog.pg_constraint pgc
				ON pgc.conname = tc.constraint_name
				AND pgc.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = tc.table_schema)
			LEFT JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			LEFT JOIN information_schema.constraint_column_usage ccu
				ON tc.constraint_name = ccu.constraint_name
				AND tc.table_schema = ccu.table_schema
				AND tc.constraint_type = 'FOREIGN KEY'
			LEFT JOIN information_schema.referential_constraints rc
				ON tc.constraint_name = rc.constraint_name
				AND tc.table_schema = rc.constraint_schema
			LEFT JOIN information_schema.check_constraints cc
				ON tc.constraint_name = cc.constraint_name
				AND tc.table_schema = cc.constraint_schema
			WHERE tc.table_schema = $1
				AND tc.table_name = $2
			GROUP BY
				tc.constraint_name,
				tc.constraint_type,
				tc.table_name,
				pgc.oid,
				ccu.table_name,
				rc.update_rule,
				rc.delete_rule,
				cc.check_clause
			ORDER BY tc.constraint_type, tc.constraint_name
		`,
			[schema, table]
		);

		return result.rows.map((row) => ({
			name: row.constraint_name,
			type: row.constraint_type as ConstraintInfo["type"],
			tableName: row.table_name,
			columns: row.column_names,
			definition: row.constraint_definition,
			referencedTable: row.referenced_table ?? undefined,
			referencedColumns: row.referenced_columns ?? undefined,
			updateRule: row.update_rule ?? undefined,
			deleteRule: row.delete_rule ?? undefined,
			checkClause: row.check_clause ?? undefined,
		}));
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
		const schema = options.schema ?? "public";
		const columns = options.columns?.map(quoteIdentifier).join(", ") ?? "*";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		let sql = `SELECT ${columns} FROM ${tableName}`;
		const values: unknown[] = [];
		let paramIndex = 1;

		if (options.filters && options.filters.length > 0) {
			const whereResult = buildWhereClause(options.filters, paramIndex);
			sql += ` ${whereResult.clause}`;
			values.push(...whereResult.values);
			paramIndex += whereResult.values.length;
		}

		if (options.orderBy && options.orderBy.length > 0) {
			const orderClauses = options.orderBy.map(
				(o) => `${quoteIdentifier(o.column)} ${o.direction}`
			);
			sql += ` ORDER BY ${orderClauses.join(", ")}`;
		}

		if (options.limit !== undefined) {
			sql += ` LIMIT $${paramIndex++}`;
			values.push(options.limit);
		}

		if (options.offset !== undefined) {
			sql += ` OFFSET $${paramIndex++}`;
			values.push(options.offset);
		}

		const timeout = options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
		return this.query(sql, values, timeout);
	}

	async countRows(options: RowCountOptions): Promise<{ count: number }> {
		const schema = options.schema ?? "public";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
		const values: unknown[] = [];

		if (options.filters && options.filters.length > 0) {
			const whereResult = buildWhereClause(options.filters, 1);
			sql += ` ${whereResult.clause}`;
			values.push(...whereResult.values);
		}

		const timeout = options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
		const result = await this.query<{ count: string }>(sql, values, timeout);
		return { count: parseInt(result.rows[0]?.count ?? "0", 10) };
	}

	async insertRow(options: RowInsertOptions): Promise<QueryResult> {
		const schema = options.schema ?? "public";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		const columns = Object.keys(options.data);
		const quotedColumns = columns.map(quoteIdentifier).join(", ");
		const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
		const values = columns.map((col) => options.data[col]);

		const sql = `INSERT INTO ${tableName} (${quotedColumns}) VALUES (${placeholders}) RETURNING *`;

		return this.query(sql, values);
	}

	async updateRows(options: RowUpdateOptions): Promise<QueryResult> {
		const schema = options.schema ?? "public";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		const columns = Object.keys(options.data);
		let paramIndex = 1;

		const setClauses = columns.map(
			(col) => `${quoteIdentifier(col)} = $${paramIndex++}`
		);
		const values = columns.map((col) => options.data[col]);

		const whereResult = buildWhereClause(options.where, paramIndex);
		values.push(...whereResult.values);

		const sql = `UPDATE ${tableName} SET ${setClauses.join(", ")} ${whereResult.clause} RETURNING *`;

		return this.query(sql, values);
	}

	async deleteRows(options: RowDeleteOptions): Promise<QueryResult> {
		const schema = options.schema ?? "public";
		const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(options.table)}`;

		const whereResult = buildWhereClause(options.where, 1);

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
	 * List databases with pagination support
	 */
	async listDatabasesPaginated(
		pagination: PaginationOptions
	): Promise<PaginatedResult<DatabaseInfo>> {
		// First, get the total count
		const countResult = await this.query<{ count: string }>(`
			SELECT COUNT(*) as count
			FROM pg_catalog.pg_database d
			WHERE d.datistemplate = false
		`);
		const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

		// Then get the paginated results
		const result = await this.query<{
			datname: string;
			owner: string;
			encoding: string;
			size: string;
			tablespace: string;
		}>(
			`
			SELECT
				d.datname,
				pg_catalog.pg_get_userbyid(d.datdba) as owner,
				pg_catalog.pg_encoding_to_char(d.encoding) as encoding,
				pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(d.datname)) as size,
				t.spcname as tablespace
			FROM pg_catalog.pg_database d
			LEFT JOIN pg_catalog.pg_tablespace t ON d.dattablespace = t.oid
			WHERE d.datistemplate = false
			ORDER BY d.datname
			LIMIT $1 OFFSET $2
		`,
			[pagination.limit, pagination.offset]
		);

		const items = result.rows.map((row) => ({
			name: row.datname,
			owner: row.owner,
			encoding: row.encoding,
			size: row.size,
			tablespace: row.tablespace,
		}));

		return {
			items,
			total,
			offset: pagination.offset,
			limit: pagination.limit,
			hasMore: pagination.offset + items.length < total,
		};
	}

	/**
	 * List schemas with pagination support
	 */
	async listSchemasPaginated(
		pagination: PaginationOptions,
		database?: string
	): Promise<PaginatedResult<SchemaInfo & { database: string }>> {
		const currentDatabase = database ?? this.config.database;

		// First, get the total count
		const countResult = await this.query<{ count: string }>(`
			SELECT COUNT(*) as count
			FROM pg_catalog.pg_namespace n
			WHERE n.nspname !~ '^pg_'
				AND n.nspname <> 'information_schema'
		`);
		const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

		// Then get the paginated results
		const result = await this.query<{
			schema_name: string;
			owner: string;
		}>(
			`
			SELECT
				n.nspname as schema_name,
				pg_catalog.pg_get_userbyid(n.nspowner) as owner
			FROM pg_catalog.pg_namespace n
			WHERE n.nspname !~ '^pg_'
				AND n.nspname <> 'information_schema'
			ORDER BY n.nspname
			LIMIT $1 OFFSET $2
		`,
			[pagination.limit, pagination.offset]
		);

		const items = result.rows.map((row) => ({
			name: row.schema_name,
			owner: row.owner,
			database: currentDatabase,
		}));

		return {
			items,
			total,
			offset: pagination.offset,
			limit: pagination.limit,
			hasMore: pagination.offset + items.length < total,
		};
	}

	/**
	 * List tables with pagination support
	 */
	async listTablesPaginated(
		schema: string = "public",
		pagination: PaginationOptions
	): Promise<PaginatedResult<TableInfo>> {
		// First, get the total count
		const countResult = await this.query<{ count: string }>(
			`
			SELECT COUNT(*) as count
			FROM pg_catalog.pg_class c
			LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
			WHERE c.relkind IN ('r', 'v', 'm')
				AND n.nspname = $1
				AND n.nspname !~ '^pg_'
				AND n.nspname <> 'information_schema'
		`,
			[schema]
		);
		const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

		// Then get the paginated results
		const result = await this.query<{
			table_name: string;
			table_schema: string;
			table_type: string;
			owner: string;
			row_count: string | null;
			size: string | null;
		}>(
			`
			SELECT
				c.relname as table_name,
				n.nspname as table_schema,
				CASE c.relkind
					WHEN 'r' THEN 'table'
					WHEN 'v' THEN 'view'
					WHEN 'm' THEN 'materialized_view'
				END as table_type,
				pg_catalog.pg_get_userbyid(c.relowner) as owner,
				c.reltuples::bigint as row_count,
				pg_catalog.pg_size_pretty(pg_catalog.pg_table_size(c.oid)) as size
			FROM pg_catalog.pg_class c
			LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
			WHERE c.relkind IN ('r', 'v', 'm')
				AND n.nspname = $1
				AND n.nspname !~ '^pg_'
				AND n.nspname <> 'information_schema'
			ORDER BY c.relname
			LIMIT $2 OFFSET $3
		`,
			[schema, pagination.limit, pagination.offset]
		);

		const items = result.rows.map((row) => ({
			name: row.table_name,
			schema: row.table_schema,
			type: row.table_type as "table" | "view" | "materialized_view",
			owner: row.owner,
			rowCount: row.row_count ? parseInt(row.row_count, 10) : null,
			size: row.size,
		}));

		return {
			items,
			total,
			offset: pagination.offset,
			limit: pagination.limit,
			hasMore: pagination.offset + items.length < total,
		};
	}

	async transaction<T>(
		callback: (client: PoolClient) => Promise<T>,
		maxRetries: number = 3
	): Promise<T> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			const client = await this.pool.connect();
			try {
				await client.query("BEGIN");
				const result = await callback(client);
				await client.query("COMMIT");
				return result;
			} catch (err: unknown) {
				await client.query("ROLLBACK");
				logger.error(`[PostgresProvider] Transaction failed (attempt ${attempt} of ${maxRetries})`, err);

				const error = err as { code?: string };
				if (this.isRetryableError(error) && attempt < maxRetries) {
					const delay = Math.pow(2, attempt) * 100;
					await new Promise((r) => setTimeout(r, delay));
					continue;
				}

				throw err;
			} finally {
				client.release();
			}
		}

		throw new Error("Transaction failed after all retries");
	}

	private isRetryableError(err: { code?: string }): boolean {
		if (!err.code) {
			return false;
		}

		const isConnectionError = err.code.startsWith("08");
		if (isConnectionError) {
			return true;
		}

		const retryableErrorCodes = new Set([
			"40001", // serialization_failure
			"40P01", // deadlock_detected
			"55P03", // lock_not_available
			"57014", // query_canceled (statement timeout)
			"53300", // too_many_connections
		]);

		return retryableErrorCodes.has(err.code);
	}

	/**
	 * Get active connections to a specific database (excluding the current connection)
	 * Returns the count of connections and details about each connection
	 */
	async getDatabaseConnections(databaseName: string): Promise<{
		count: number;
		connections: Array<{
			pid: number;
			username: string;
			applicationName: string | null;
			clientAddr: string | null;
			state: string | null;
			queryStart: Date | null;
		}>;
	}> {
		const result = await this.query<{
			pid: number;
			usename: string;
			application_name: string | null;
			client_addr: string | null;
			state: string | null;
			query_start: Date | null;
		}>(
			`
			SELECT
				pid,
				usename,
				application_name,
				client_addr::text,
				state,
				query_start
			FROM pg_stat_activity
			WHERE datname = $1
			AND pid <> pg_backend_pid()
			ORDER BY query_start DESC NULLS LAST
			`,
			[databaseName]
		);

		return {
			count: result.rows.length,
			connections: result.rows.map((row) => ({
				pid: row.pid,
				username: row.usename,
				applicationName: row.application_name,
				clientAddr: row.client_addr,
				state: row.state,
				queryStart: row.query_start,
			})),
		};
	}

	/**
	 * Rename a database
	 * Note: This requires that no one is connected to the database being renamed
	 * @param force - If true, terminate existing connections before renaming
	 */
	async renameDatabase(oldName: string, newName: string, force = false): Promise<void> {
		// Validate database names to prevent SQL injection
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(oldName) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
			throw new Error("Invalid database name. Database names must start with a letter or underscore and contain only alphanumeric characters and underscores.");
		}

		// Check for existing connections
		const connectionInfo = await this.getDatabaseConnections(oldName);
		if (connectionInfo.count > 0 && !force) {
			throw new Error(
				`Cannot rename database: ${connectionInfo.count} active connection(s) exist. Use force option to terminate connections and proceed.`
			);
		}

		// Terminate all connections to the database if force is enabled or no connections exist
		if (connectionInfo.count > 0) {
			await this.query(
				`
				SELECT pg_terminate_backend(pg_stat_activity.pid)
				FROM pg_stat_activity
				WHERE pg_stat_activity.datname = $1
				AND pid <> pg_backend_pid()
				`,
				[oldName]
			);
			logger.info("[PostgresProvider] Terminated connections before rename", {
				databaseName: oldName,
				terminatedCount: connectionInfo.count,
			});
		}

		// Then rename the database
		const sql = `ALTER DATABASE ${quoteIdentifier(oldName)} RENAME TO ${quoteIdentifier(newName)}`;
		await this.query(sql);

		logger.info("[PostgresProvider] Database renamed", { oldName, newName, force });
	}

	/**
	 * Create a new database
	 * @param databaseName - Name for the new database
	 * @param owner - Optional owner for the database (defaults to current user)
	 * @param encoding - Optional encoding (defaults to UTF8)
	 * @param template - Optional template database (defaults to template1)
	 */
	async createDatabase(
		databaseName: string,
		options?: {
			owner?: string;
			encoding?: string;
			template?: string;
		}
	): Promise<void> {
		// Validate database name to prevent SQL injection
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
			throw new Error("Invalid database name. Database names must start with a letter or underscore and contain only alphanumeric characters and underscores.");
		}

		// Prevent creating databases with reserved names
		const reservedNames = ["postgres", "template0", "template1"];
		if (reservedNames.includes(databaseName.toLowerCase())) {
			throw new Error(`Cannot create database with reserved name: ${databaseName}`);
		}

		// Build the CREATE DATABASE statement
		let sql = `CREATE DATABASE ${quoteIdentifier(databaseName)}`;

		if (options?.owner) {
			if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(options.owner)) {
				throw new Error("Invalid owner name.");
			}
			sql += ` OWNER ${quoteIdentifier(options.owner)}`;
		}

		if (options?.encoding) {
			// Encoding is a string literal, not an identifier
			sql += ` ENCODING '${options.encoding.replace(/'/g, "''")}'`;
		}

		if (options?.template) {
			if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(options.template)) {
				throw new Error("Invalid template name.");
			}
			sql += ` TEMPLATE ${quoteIdentifier(options.template)}`;
		}

		await this.query(sql);

		logger.info("[PostgresProvider] Database created", { databaseName, options });
	}

	/**
	 * Delete (drop) a database
	 * Note: This requires that no one is connected to the database being dropped
	 * @param force - If true, terminate existing connections before deleting
	 */
	async deleteDatabase(databaseName: string, force = false): Promise<void> {
		// Validate database name to prevent SQL injection
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
			throw new Error("Invalid database name. Database names must start with a letter or underscore and contain only alphanumeric characters and underscores.");
		}

		// Prevent dropping system databases
		const systemDatabases = ["postgres", "template0", "template1"];
		if (systemDatabases.includes(databaseName.toLowerCase())) {
			throw new Error(`Cannot delete system database: ${databaseName}`);
		}

		// Check for existing connections
		const connectionInfo = await this.getDatabaseConnections(databaseName);
		if (connectionInfo.count > 0 && !force) {
			throw new Error(
				`Cannot delete database: ${connectionInfo.count} active connection(s) exist. Use force option to terminate connections and proceed.`
			);
		}

		// Terminate all connections to the database if force is enabled
		if (connectionInfo.count > 0) {
			await this.query(
				`
				SELECT pg_terminate_backend(pg_stat_activity.pid)
				FROM pg_stat_activity
				WHERE pg_stat_activity.datname = $1
				AND pid <> pg_backend_pid()
				`,
				[databaseName]
			);
			logger.info("[PostgresProvider] Terminated connections before delete", {
				databaseName,
				terminatedCount: connectionInfo.count,
			});
		}

		// Then drop the database
		const sql = `DROP DATABASE ${quoteIdentifier(databaseName)}`;
		await this.query(sql);

		logger.info("[PostgresProvider] Database deleted", { databaseName, force });
	}
}
