/**
 * SQL utilities for detecting and analyzing SQL queries
 */

/**
 * Destructive operation types that require warnings
 */
export type DestructiveOperationType =
	| "DROP_DATABASE"
	| "DROP_TABLE"
	| "DROP_SCHEMA"
	| "DROP_INDEX"
	| "DROP_VIEW"
	| "TRUNCATE"
	| "DELETE_WITHOUT_WHERE"
	| "ALTER_DROP";

/**
 * Information about a detected destructive operation
 */
export interface DestructiveOperationInfo {
	type: DestructiveOperationType;
	/** Human-readable description of the operation */
	description: string;
	/** The SQL statement that triggered the detection */
	statement: string;
	/** Object name affected (if detectable) */
	objectName?: string;
	/** Severity level for UI display */
	severity: "high" | "critical";
}

/**
 * Result of analyzing SQL for destructive operations
 */
export interface SqlAnalysisResult {
	/** Whether any destructive operations were detected */
	hasDestructiveOperations: boolean;
	/** List of detected destructive operations */
	operations: DestructiveOperationInfo[];
}

// Regular expression patterns for detecting destructive operations
const patterns = {
	// DROP DATABASE - critical
	dropDatabase: /\bDROP\s+DATABASE\s+(?:IF\s+EXISTS\s+)?["'`]?(\w+)["'`]?/gi,
	// DROP TABLE - high
	dropTable: /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:["'`]?[\w.]+["'`]?\s*,\s*)*["'`]?([\w.]+)["'`]?/gi,
	// DROP SCHEMA - critical
	dropSchema: /\bDROP\s+SCHEMA\s+(?:IF\s+EXISTS\s+)?(?:CASCADE\s+)?["'`]?(\w+)["'`]?/gi,
	// DROP INDEX - high
	dropIndex: /\bDROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:CONCURRENTLY\s+)?["'`]?([\w.]+)["'`]?/gi,
	// DROP VIEW - high
	dropView: /\bDROP\s+(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+EXISTS\s+)?["'`]?([\w.]+)["'`]?/gi,
	// TRUNCATE - high
	truncate: /\bTRUNCATE\s+(?:TABLE\s+)?(?:ONLY\s+)?["'`]?([\w.]+)["'`]?/gi,
	// DELETE without WHERE - high
	deleteWithoutWhere: /\bDELETE\s+FROM\s+["'`]?([\w.]+)["'`]?\s*(?:;|$)/gi,
	// ALTER TABLE DROP COLUMN/CONSTRAINT - high
	alterDrop: /\bALTER\s+TABLE\s+["'`]?([\w.]+)["'`]?\s+DROP\s+(?:COLUMN|CONSTRAINT)\s+(?:IF\s+EXISTS\s+)?["'`]?(\w+)["'`]?/gi,
};

/**
 * Check if a DELETE statement has a WHERE clause
 * @param sql - The SQL statement to check
 * @returns true if the DELETE has a WHERE clause
 */
function hasWhereClause(sql: string): boolean {
	// Remove comments and normalize whitespace
	const normalized = removeComments(sql).replace(/\s+/g, " ").trim();
	// Check if there's a WHERE after DELETE FROM
	return /\bDELETE\s+FROM\s+["'`]?\w+["'`]?\s+WHERE\b/i.test(normalized);
}

/**
 * Remove SQL comments from a string
 * @param sql - The SQL string to process
 * @returns SQL without comments
 */
function removeComments(sql: string): string {
	// Remove single-line comments
	let result = sql.replace(/--.*$/gm, "");
	// Remove multi-line comments
	result = result.replace(/\/\*[\s\S]*?\*\//g, "");
	return result;
}

/**
 * Extract object name from a regex match
 * @param match - The regex match result
 * @returns The extracted object name or undefined
 */
function extractObjectName(match: RegExpExecArray): string | undefined {
	// Return the first captured group that has content
	for (let i = 1; i < match.length; i++) {
		if (match[i]) {
			return match[i];
		}
	}
	return undefined;
}

/**
 * Analyze SQL for destructive operations
 * @param sql - The SQL query to analyze
 * @returns Analysis result with detected destructive operations
 */
export function analyzeDestructiveSql(sql: string): SqlAnalysisResult {
	const operations: DestructiveOperationInfo[] = [];
	const normalizedSql = removeComments(sql);

	// Check for DROP DATABASE
	let match: RegExpExecArray | null;
	const dropDatabasePattern = new RegExp(patterns.dropDatabase.source, "gi");
	while ((match = dropDatabasePattern.exec(normalizedSql)) !== null) {
		operations.push({
			type: "DROP_DATABASE",
			description: `Drop database${match[1] ? ` "${match[1]}"` : ""}`,
			statement: match[0],
			objectName: extractObjectName(match),
			severity: "critical",
		});
	}

	// Check for DROP SCHEMA
	const dropSchemaPattern = new RegExp(patterns.dropSchema.source, "gi");
	while ((match = dropSchemaPattern.exec(normalizedSql)) !== null) {
		operations.push({
			type: "DROP_SCHEMA",
			description: `Drop schema${match[1] ? ` "${match[1]}"` : ""}`,
			statement: match[0],
			objectName: extractObjectName(match),
			severity: "critical",
		});
	}

	// Check for DROP TABLE
	const dropTablePattern = new RegExp(patterns.dropTable.source, "gi");
	while ((match = dropTablePattern.exec(normalizedSql)) !== null) {
		operations.push({
			type: "DROP_TABLE",
			description: `Drop table${match[1] ? ` "${match[1]}"` : ""}`,
			statement: match[0],
			objectName: extractObjectName(match),
			severity: "high",
		});
	}

	// Check for DROP INDEX
	const dropIndexPattern = new RegExp(patterns.dropIndex.source, "gi");
	while ((match = dropIndexPattern.exec(normalizedSql)) !== null) {
		operations.push({
			type: "DROP_INDEX",
			description: `Drop index${match[1] ? ` "${match[1]}"` : ""}`,
			statement: match[0],
			objectName: extractObjectName(match),
			severity: "high",
		});
	}

	// Check for DROP VIEW
	const dropViewPattern = new RegExp(patterns.dropView.source, "gi");
	while ((match = dropViewPattern.exec(normalizedSql)) !== null) {
		operations.push({
			type: "DROP_VIEW",
			description: `Drop view${match[1] ? ` "${match[1]}"` : ""}`,
			statement: match[0],
			objectName: extractObjectName(match),
			severity: "high",
		});
	}

	// Check for TRUNCATE
	const truncatePattern = new RegExp(patterns.truncate.source, "gi");
	while ((match = truncatePattern.exec(normalizedSql)) !== null) {
		operations.push({
			type: "TRUNCATE",
			description: `Truncate table${match[1] ? ` "${match[1]}"` : ""} (removes all rows)`,
			statement: match[0],
			objectName: extractObjectName(match),
			severity: "high",
		});
	}

	// Check for DELETE without WHERE
	const deletePattern = new RegExp(patterns.deleteWithoutWhere.source, "gi");
	while ((match = deletePattern.exec(normalizedSql)) !== null) {
		// Only add if there's no WHERE clause
		if (!hasWhereClause(normalizedSql)) {
			operations.push({
				type: "DELETE_WITHOUT_WHERE",
				description: `Delete all rows from${match[1] ? ` "${match[1]}"` : " table"} (no WHERE clause)`,
				statement: match[0],
				objectName: extractObjectName(match),
				severity: "high",
			});
		}
	}

	// Check for ALTER TABLE DROP
	const alterDropPattern = new RegExp(patterns.alterDrop.source, "gi");
	while ((match = alterDropPattern.exec(normalizedSql)) !== null) {
		operations.push({
			type: "ALTER_DROP",
			description: `Drop column/constraint "${match[2]}" from table "${match[1]}"`,
			statement: match[0],
			objectName: match[2],
			severity: "high",
		});
	}

	return {
		hasDestructiveOperations: operations.length > 0,
		operations,
	};
}

/**
 * Get a human-readable message for a destructive operation
 * @param type - The type of destructive operation
 * @returns Human-readable message
 */
export function getDestructiveOperationMessage(type: DestructiveOperationType): string {
	const messages: Record<DestructiveOperationType, string> = {
		DROP_DATABASE: "This will permanently delete the entire database and all its contents.",
		DROP_TABLE: "This will permanently delete the table and all its data.",
		DROP_SCHEMA: "This will permanently delete the schema and all objects within it.",
		DROP_INDEX: "This will remove the index, which may affect query performance.",
		DROP_VIEW: "This will delete the view. Dependent objects may be affected.",
		TRUNCATE: "This will remove all rows from the table. This action cannot be rolled back.",
		DELETE_WITHOUT_WHERE: "This will delete ALL rows from the table because no WHERE clause was specified.",
		ALTER_DROP: "This will permanently remove the column or constraint from the table.",
	};

	return messages[type];
}
