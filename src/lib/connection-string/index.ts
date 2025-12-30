/**
 * Connection string utilities for parsing and building database connection strings
 */

export interface ParsedConnectionString {
	providerType: "postgres" | "mysql" | "mongodb" | "redis" | "sqlite";
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
	sslEnabled: boolean;
	options: Record<string, string>;
}

export interface ConnectionStringError {
	message: string;
	field?: string;
}

/**
 * Default ports for various database providers
 */
const DEFAULT_PORTS: Record<string, number> = {
	postgres: 5432,
	postgresql: 5432,
	mysql: 3306,
	mongodb: 27017,
	redis: 6379,
	sqlite: 0,
};

/**
 * Protocol to provider type mapping
 */
const PROTOCOL_MAP: Record<string, ParsedConnectionString["providerType"]> = {
	postgres: "postgres",
	postgresql: "postgres",
	mysql: "mysql",
	mongodb: "mongodb",
	"mongodb+srv": "mongodb",
	redis: "redis",
	rediss: "redis",
	sqlite: "sqlite",
};

/**
 * Parse a connection string into its components
 * Supports formats like:
 * - postgres://user:password@host:port/database?ssl=true
 * - mysql://user:password@host:port/database
 * - mongodb://user:password@host:port/database
 */
export function parseConnectionString(connectionString: string): {
	success: true;
	data: ParsedConnectionString;
} | {
	success: false;
	error: ConnectionStringError;
} {
	const trimmed = connectionString.trim();

	if (!trimmed) {
		return {
			success: false,
			error: { message: "Connection string is required" },
		};
	}

	try {
		// Try to parse as URL
		const url = new URL(trimmed);
		const protocol = url.protocol.replace(":", "").toLowerCase();

		const providerType = PROTOCOL_MAP[protocol];
		if (!providerType) {
			return {
				success: false,
				error: {
					message: `Unsupported protocol: ${protocol}. Supported protocols: ${Object.keys(PROTOCOL_MAP).join(", ")}`,
					field: "providerType",
				},
			};
		}

		const username = decodeURIComponent(url.username || "");
		const password = decodeURIComponent(url.password || "");
		const host = url.hostname || "localhost";
		const port = url.port ? parseInt(url.port, 10) : DEFAULT_PORTS[protocol] ?? 5432;
		const database = url.pathname.slice(1) || ""; // Remove leading /

		// Parse query parameters for SSL and other options
		const options: Record<string, string> = {};
		let sslEnabled = false;

		url.searchParams.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			if (lowerKey === "ssl" || lowerKey === "sslmode") {
				sslEnabled = value === "true" || value === "require" || value === "verify-ca" || value === "verify-full";
			} else {
				options[key] = value;
			}
		});

		// For rediss:// protocol, SSL is always enabled
		if (protocol === "rediss") {
			sslEnabled = true;
		}

		return {
			success: true,
			data: {
				providerType,
				host,
				port,
				database,
				username,
				password,
				sslEnabled,
				options,
			},
		};
	} catch {
		return {
			success: false,
			error: {
				message: "Invalid connection string format. Expected format: protocol://user:password@host:port/database",
			},
		};
	}
}

/**
 * Build a connection string from discrete fields
 */
export function buildConnectionString(params: {
	providerType: string;
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
	sslEnabled?: boolean;
}): string {
	const { providerType, host, port, database, username, password, sslEnabled } = params;

	// Encode credentials
	const encodedUsername = encodeURIComponent(username);
	const encodedPassword = encodeURIComponent(password);

	// Build auth string
	let authString = "";
	if (username) {
		authString = password ? `${encodedUsername}:${encodedPassword}@` : `${encodedUsername}@`;
	}

	// Build query string
	const queryParams: string[] = [];
	if (sslEnabled) {
		queryParams.push("ssl=true");
	}
	const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

	// Determine protocol
	let protocol = providerType;
	if (providerType === "postgres") {
		protocol = "postgresql";
	}

	// Build final connection string
	const portStr = port ? `:${port}` : "";
	const databasePath = database ? `/${database}` : "";

	return `${protocol}://${authString}${host}${portStr}${databasePath}${queryString}`;
}

/**
 * Validate a connection string and return detailed errors
 */
export function validateConnectionString(connectionString: string): ConnectionStringError[] {
	const errors: ConnectionStringError[] = [];

	const result = parseConnectionString(connectionString);
	if (!result.success) {
		errors.push(result.error);
		return errors;
	}

	const { data } = result;

	if (!data.host) {
		errors.push({ message: "Host is required", field: "host" });
	}

	if (data.port < 1 || data.port > 65535) {
		errors.push({ message: "Port must be between 1 and 65535", field: "port" });
	}

	if (!data.database) {
		errors.push({ message: "Database name is required", field: "database" });
	}

	if (!data.username) {
		errors.push({ message: "Username is required", field: "username" });
	}

	return errors;
}
