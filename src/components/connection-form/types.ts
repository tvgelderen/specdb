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
 * Form field values for discrete field mode
 */
export interface ConnectionFormFields {
	name: string;
	providerType: ProviderType;
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
	sslConfig: SSLConfig;
	maxPoolSize: number;
	idleTimeoutMs: number;
	connectionTimeoutMs: number;
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
 * Validation schema for connection form fields
 */
export const connectionFormFieldsSchema = z.object({
	name: z.string().min(1, "Connection name is required").max(255, "Connection name is too long"),
	providerType: z.enum(providerTypes, { message: "Please select a database type" }),
	host: z.string().min(1, "Host is required"),
	port: z.coerce.number().int().min(1, "Port must be at least 1").max(65535, "Port must be at most 65535"),
	database: z.string().min(1, "Database name is required"),
	username: z.string().min(1, "Username is required"),
	password: z.string(), // Can be empty for some auth methods
	sslConfig: z.object({
		enabled: z.boolean(),
		rejectUnauthorized: z.boolean().optional(),
	}),
	maxPoolSize: z.coerce.number().int().min(1).max(100).default(10),
	idleTimeoutMs: z.coerce.number().int().min(0).max(3600000).default(30000),
	connectionTimeoutMs: z.coerce.number().int().min(100).max(60000).default(5000),
	color: z.string().max(50).nullable().optional(),
	notes: z.string().max(1000).nullable().optional(),
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
 * Only PostgreSQL is currently available, other providers are coming soon
 */
export const enabledProviders: Set<ProviderType> = new Set(["postgres"]);

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
	color: null,
	notes: null,
};
