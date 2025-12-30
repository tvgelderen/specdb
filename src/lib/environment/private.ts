export interface PrivateEnvConfig {
	NODE_ENV: "development" | "production";

	DB_PATH: string;

	ENCRYPTION_KEY?: string;
}

function validatePrivateEnv(): PrivateEnvConfig {
	if (typeof window !== "undefined") {
		throw new Error("Private environment variables cannot be accessed on the client side");
	}

	const errors: string[] = [];

	const NODE_ENV = process.env.NODE_ENV === "production" ? "production" : "development";

	const DB_PATH = process.env.DB_PATH;

	if (!DB_PATH) {
		errors.push("DB_PATH is required but not set");
	}

	if (errors.length > 0) {
		throw new Error(`Private environment validation failed:\n${errors.join("\n")}`);
	}

	return {
		NODE_ENV: NODE_ENV,

		DB_PATH: DB_PATH!,

		ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
	};
}

const privateEnv = validatePrivateEnv();

export const NODE_ENV = privateEnv.NODE_ENV;

export const DB_PATH = privateEnv.DB_PATH;

export const ENCRYPTION_KEY = privateEnv.ENCRYPTION_KEY;
