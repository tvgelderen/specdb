import { z } from "zod/v4";

/**
 * Supported database provider types
 */
export const providerTypes = ["postgres", "mysql", "sqlite", "mongodb", "redis"] as const;
export type ProviderType = (typeof providerTypes)[number];

/**
 * SSL configuration options
 */
export interface SSLConfig {
	enabled: boolean;
	rejectUnauthorized?: boolean;
}

/**
 * SQLite-specific configuration options
 */
export interface SqliteConfig {
	/** Path to the SQLite database file */
	filepath: string;
	/** Open database in readonly mode */
	readonly: boolean;
	/** If true, throws error if file doesn't exist. If false, creates new database */
	fileMustExist: boolean;
	/** Enable WAL mode for better concurrent access */
	enableWAL: boolean;
	/** Enable foreign key constraints */
	enableForeignKeys: boolean;
}

/**
 * Form field values for discrete field mode
 */
export interface ConnectionFormFields {
	name: string;
	providerType: ProviderType;
	// Common fields (used by postgres, mysql, etc.)
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
	sslConfig: SSLConfig;
	maxPoolSize: number;
	idleTimeoutMs: number;
	connectionTimeoutMs: number;
	// SQLite-specific fields
	sqliteConfig: SqliteConfig;
	// Metadata
	color: string | null;
	notes: string | null;
}

/**
 * Connection string mode values
 */
export interface ConnectionStringMode {
	connectionString: string;
	name: string;
	sslConfig: SSLConfig;
	maxPoolSize: number;
	idleTimeoutMs: number;
	connectionTimeoutMs: number;
	color: string | null;
	notes: string | null;
}

/**
 * Form input mode
 */
export type InputMode = "fields" | "connectionString";

/**
 * SQLite config schema
 */
export const sqliteConfigSchema = z.object({
	filepath: z.string().min(1, "File path is required"),
	readonly: z.boolean().default(false),
	fileMustExist: z.boolean().default(true),
	enableWAL: z.boolean().default(true),
	enableForeignKeys: z.boolean().default(true),
});

/**
 * Base validation schema for connection form fields
 */
const baseConnectionFormFieldsSchema = z.object({
	name: z.string().min(1, "Connection name is required").max(255, "Connection name is too long"),
	providerType: z.enum(providerTypes, { message: "Please select a database type" }),
	host: z.string(),
	port: z.coerce.number().int().min(0).max(65535),
	database: z.string(),
	username: z.string(),
	password: z.string(),
	sslConfig: z.object({
		enabled: z.boolean(),
		rejectUnauthorized: z.boolean().optional(),
	}),
	maxPoolSize: z.coerce.number().int().min(1).max(100).default(10),
	idleTimeoutMs: z.coerce.number().int().min(0).max(3600000).default(30000),
	connectionTimeoutMs: z.coerce.number().int().min(100).max(60000).default(5000),
	sqliteConfig: sqliteConfigSchema,
	color: z.string().max(50).nullable().optional(),
	notes: z.string().max(1000).nullable().optional(),
});

/**
 * Validation schema for connection form fields
 * Uses discriminated validation based on provider type
 */
export const connectionFormFieldsSchema = baseConnectionFormFieldsSchema.superRefine((data, ctx) => {
	if (data.providerType === "sqlite") {
		// SQLite only requires filepath
		if (!data.sqliteConfig.filepath || data.sqliteConfig.filepath.trim() === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "File path is required for SQLite",
				path: ["sqliteConfig", "filepath"],
			});
		}
	} else {
		// Other providers require host, port, database, username
		if (!data.host || data.host.trim() === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Host is required",
				path: ["host"],
			});
		}
		if (data.port < 1 || data.port > 65535) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Port must be between 1 and 65535",
				path: ["port"],
			});
		}
		if (!data.database || data.database.trim() === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Database name is required",
				path: ["database"],
			});
		}
		if (!data.username || data.username.trim() === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Username is required",
				path: ["username"],
			});
		}
	}
});

/**
 * Connection test result
 */
export interface ConnectionTestResult {
	success: boolean;
	message: string;
	latencyMs: number;
}

/**
 * Connection test status
 */
export type TestStatus = "idle" | "testing" | "success" | "error";

/**
 * Field validation errors
 */
export type FieldErrors = Partial<Record<keyof ConnectionFormFields | "connectionString", string>>;

/**
 * Default port values for each provider type
 */
export const defaultPorts: Record<ProviderType, number> = {
	postgres: 5432,
	mysql: 3306,
	sqlite: 0,
	mongodb: 27017,
	redis: 6379,
};

/**
 * Provider types that are currently enabled/supported
 * PostgreSQL and SQLite are currently available, other providers are coming soon
 */
export const enabledProviders: Set<ProviderType> = new Set(["postgres", "sqlite"]);

/**
 * Default SQLite configuration values
 */
export const defaultSqliteConfig: SqliteConfig = {
	filepath: "",
	readonly: false,
	fileMustExist: true,
	enableWAL: true,
	enableForeignKeys: true,
};

/**
 * Default form values
 */
export const defaultFormValues: ConnectionFormFields = {
	name: "",
	providerType: "postgres",
	host: "localhost",
	port: 5432,
	database: "",
	username: "",
	password: "",
	sslConfig: {
		enabled: false,
		rejectUnauthorized: true,
	},
	maxPoolSize: 10,
	idleTimeoutMs: 30000,
	connectionTimeoutMs: 5000,
	sqliteConfig: defaultSqliteConfig,
	color: null,
	notes: null,
};
