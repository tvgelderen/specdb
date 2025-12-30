import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";
import { db } from "~/db";
import { connections, type Connection } from "~/db/schema";
import { encrypt, decrypt } from "~/lib/encryption";
import { ProviderRegistry } from "~/providers/db-provider/registry";
import type { ProviderType } from "~/providers/db-provider/types";
import logger from "~/lib/logging";

/**
 * Zod schemas for connection input validation
 */
const providerTypeSchema = z.enum(["postgres", "mysql", "sqlite", "mongodb", "redis"]);

const sslConfigSchema = z
	.object({
		enabled: z.boolean(),
		rejectUnauthorized: z.boolean().optional(),
	})
	.nullable()
	.optional();

const createConnectionSchema = z.object({
	name: z.string().min(1, "Connection name is required").max(255),
	providerType: providerTypeSchema,
	host: z.string().min(1, "Host is required"),
	port: z.number().int().min(1).max(65535),
	database: z.string().min(1, "Database name is required"),
	username: z.string().min(1, "Username is required"),
	password: z.string(), // Can be empty for some auth methods
	sslConfig: sslConfigSchema,
	maxPoolSize: z.number().int().min(1).max(100).default(10),
	idleTimeoutMs: z.number().int().min(0).max(3600000).default(30000),
	connectionTimeoutMs: z.number().int().min(100).max(60000).default(5000),
	color: z.string().max(50).nullable().optional(),
	notes: z.string().max(1000).nullable().optional(),
});

const updateConnectionSchema = z.object({
	id: z.number().int().positive(),
	name: z.string().min(1).max(255).optional(),
	providerType: providerTypeSchema.optional(),
	host: z.string().min(1).optional(),
	port: z.number().int().min(1).max(65535).optional(),
	database: z.string().min(1).optional(),
	username: z.string().min(1).optional(),
	password: z.string().optional(), // Only update if provided
	sslConfig: sslConfigSchema,
	maxPoolSize: z.number().int().min(1).max(100).optional(),
	idleTimeoutMs: z.number().int().min(0).max(3600000).optional(),
	connectionTimeoutMs: z.number().int().min(100).max(60000).optional(),
	color: z.string().max(50).nullable().optional(),
	notes: z.string().max(1000).nullable().optional(),
});

const testConnectionSchema = z.object({
	providerType: providerTypeSchema,
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535),
	database: z.string().min(1),
	username: z.string().min(1),
	password: z.string(),
	sslConfig: sslConfigSchema,
	connectionTimeoutMs: z.number().int().min(100).max(60000).default(5000),
});

/**
 * Response type for connection without the encrypted password
 */
interface SafeConnection {
	id: number;
	name: string;
	providerType: string;
	host: string;
	port: number;
	database: string;
	username: string;
	sslConfig: { enabled: boolean; rejectUnauthorized?: boolean } | null;
	maxPoolSize: number | null;
	idleTimeoutMs: number | null;
	connectionTimeoutMs: number | null;
	isActive: boolean;
	color: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Converts a database connection to a safe response (without encrypted password)
 */
function toSafeConnection(conn: Connection): SafeConnection {
	return {
		id: conn.id,
		name: conn.name,
		providerType: conn.providerType,
		host: conn.host,
		port: conn.port,
		database: conn.database,
		username: conn.username,
		sslConfig: conn.sslConfig ? JSON.parse(conn.sslConfig) : null,
		maxPoolSize: conn.maxPoolSize,
		idleTimeoutMs: conn.idleTimeoutMs,
		connectionTimeoutMs: conn.connectionTimeoutMs,
		isActive: conn.isActive,
		color: conn.color,
		notes: conn.notes,
		createdAt: conn.createdAt,
		updatedAt: conn.updatedAt,
	};
}

/**
 * Build provider-specific connection config from stored connection
 */
function buildProviderConfig(conn: Connection, decryptedPassword: string): Record<string, unknown> {
	const sslConfig = conn.sslConfig ? JSON.parse(conn.sslConfig) : null;

	// Base config shared by most providers
	const baseConfig = {
		host: conn.host,
		port: conn.port,
		database: conn.database,
		user: conn.username,
		password: decryptedPassword,
		max: conn.maxPoolSize ?? 10,
		idleTimeoutMillis: conn.idleTimeoutMs ?? 30000,
		connectionTimeoutMillis: conn.connectionTimeoutMs ?? 5000,
	};

	// Add SSL config if enabled
	if (sslConfig?.enabled) {
		return {
			...baseConfig,
			ssl: sslConfig.rejectUnauthorized !== undefined
				? { rejectUnauthorized: sslConfig.rejectUnauthorized }
				: true,
		};
	}

	return baseConfig;
}

export const connectionsRouter = router({
	/**
	 * Create a new connection
	 */
	create: publicProcedure.input(createConnectionSchema).mutation(async ({ input }) => {
		logger.info(`[Connections] Creating connection: ${input.name}`);

		// Encrypt the password before storing
		const encryptedPassword = encrypt(input.password);

		const result = db
			.insert(connections)
			.values({
				name: input.name,
				providerType: input.providerType,
				host: input.host,
				port: input.port,
				database: input.database,
				username: input.username,
				encryptedPassword,
				sslConfig: input.sslConfig ? JSON.stringify(input.sslConfig) : null,
				maxPoolSize: input.maxPoolSize,
				idleTimeoutMs: input.idleTimeoutMs,
				connectionTimeoutMs: input.connectionTimeoutMs,
				color: input.color ?? null,
				notes: input.notes ?? null,
				isActive: false,
			})
			.returning()
			.get();

		logger.info(`[Connections] Created connection: ${result.id} - ${result.name}`);
		return toSafeConnection(result);
	}),

	/**
	 * Get all connections
	 */
	list: publicProcedure.query(async () => {
		const result = db.select().from(connections).all();
		return result.map(toSafeConnection);
	}),

	/**
	 * Get a single connection by ID
	 */
	get: publicProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.query(async ({ input }) => {
			const result = db
				.select()
				.from(connections)
				.where(eq(connections.id, input.id))
				.get();

			if (!result) {
				throw new Error(`Connection with ID ${input.id} not found`);
			}

			return toSafeConnection(result);
		}),

	/**
	 * Get the currently active connection
	 */
	getActive: publicProcedure.query(async () => {
		const result = db
			.select()
			.from(connections)
			.where(eq(connections.isActive, true))
			.get();

		return result ? toSafeConnection(result) : null;
	}),

	/**
	 * Update a connection
	 */
	update: publicProcedure.input(updateConnectionSchema).mutation(async ({ input }) => {
		const { id, password, sslConfig, ...updateData } = input;

		logger.info(`[Connections] Updating connection: ${id}`);

		// Check if connection exists
		const existing = db
			.select()
			.from(connections)
			.where(eq(connections.id, id))
			.get();

		if (!existing) {
			throw new Error(`Connection with ID ${id} not found`);
		}

		// Build update values
		const updateValues: Record<string, unknown> = {
			...updateData,
			updatedAt: sql`datetime('now')`,
		};

		// Handle SSL config
		if (sslConfig !== undefined) {
			updateValues.sslConfig = sslConfig ? JSON.stringify(sslConfig) : null;
		}

		// Only update password if provided
		if (password !== undefined) {
			updateValues.encryptedPassword = encrypt(password);
		}

		const result = db
			.update(connections)
			.set(updateValues)
			.where(eq(connections.id, id))
			.returning()
			.get();

		logger.info(`[Connections] Updated connection: ${result.id} - ${result.name}`);
		return toSafeConnection(result);
	}),

	/**
	 * Delete a connection
	 */
	delete: publicProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			logger.info(`[Connections] Deleting connection: ${input.id}`);

			const existing = db
				.select()
				.from(connections)
				.where(eq(connections.id, input.id))
				.get();

			if (!existing) {
				throw new Error(`Connection with ID ${input.id} not found`);
			}

			db.delete(connections).where(eq(connections.id, input.id)).run();

			logger.info(`[Connections] Deleted connection: ${input.id} - ${existing.name}`);
			return { success: true, deletedId: input.id };
		}),

	/**
	 * Set a connection as active (and deactivate all others)
	 */
	setActive: publicProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			logger.info(`[Connections] Setting active connection: ${input.id}`);

			// Check if connection exists
			const existing = db
				.select()
				.from(connections)
				.where(eq(connections.id, input.id))
				.get();

			if (!existing) {
				throw new Error(`Connection with ID ${input.id} not found`);
			}

			// Deactivate all connections first
			db.update(connections)
				.set({ isActive: false, updatedAt: sql`datetime('now')` })
				.run();

			// Activate the selected connection
			const result = db
				.update(connections)
				.set({ isActive: true, updatedAt: sql`datetime('now')` })
				.where(eq(connections.id, input.id))
				.returning()
				.get();

			logger.info(`[Connections] Active connection set: ${result.id} - ${result.name}`);
			return toSafeConnection(result);
		}),

	/**
	 * Clear the active connection (deactivate all)
	 */
	clearActive: publicProcedure.mutation(async () => {
		logger.info("[Connections] Clearing active connection");

		db.update(connections)
			.set({ isActive: false, updatedAt: sql`datetime('now')` })
			.run();

		return { success: true };
	}),

	/**
	 * Test a connection with provided credentials (without saving)
	 */
	test: publicProcedure.input(testConnectionSchema).mutation(async ({ input }) => {
		logger.info(`[Connections] Testing connection: ${input.providerType}://${input.host}:${input.port}/${input.database}`);

		const providerType = input.providerType as ProviderType;

		// Check if the provider is registered
		if (!ProviderRegistry.isRegistered(providerType)) {
			return {
				success: false,
				message: `Provider type '${providerType}' is not supported or not registered`,
				latencyMs: 0,
			};
		}

		const startTime = Date.now();

		try {
			// Build connection config
			const config = {
				host: input.host,
				port: input.port,
				database: input.database,
				user: input.username,
				password: input.password,
				connectionTimeoutMillis: input.connectionTimeoutMs,
				ssl: input.sslConfig?.enabled
					? input.sslConfig.rejectUnauthorized !== undefined
						? { rejectUnauthorized: input.sslConfig.rejectUnauthorized }
						: true
					: undefined,
			};

			// Create a temporary provider instance to test
			const provider = ProviderRegistry.createProvider(providerType, config);
			await provider.connect();
			await provider.disconnect();

			const latencyMs = Date.now() - startTime;

			logger.info(`[Connections] Connection test successful: ${latencyMs}ms`);
			return {
				success: true,
				message: "Connection successful",
				latencyMs,
			};
		} catch (error) {
			const latencyMs = Date.now() - startTime;
			const message = error instanceof Error ? error.message : "Unknown error";

			logger.warn(`[Connections] Connection test failed: ${message}`);
			return {
				success: false,
				message,
				latencyMs,
			};
		}
	}),

	/**
	 * Test a saved connection by ID
	 */
	testById: publicProcedure
		.input(z.object({ id: z.number().int().positive() }))
		.mutation(async ({ input }) => {
			logger.info(`[Connections] Testing saved connection: ${input.id}`);

			const conn = db
				.select()
				.from(connections)
				.where(eq(connections.id, input.id))
				.get();

			if (!conn) {
				throw new Error(`Connection with ID ${input.id} not found`);
			}

			const providerType = conn.providerType as ProviderType;

			// Check if the provider is registered
			if (!ProviderRegistry.isRegistered(providerType)) {
				return {
					success: false,
					message: `Provider type '${providerType}' is not supported or not registered`,
					latencyMs: 0,
				};
			}

			const startTime = Date.now();

			try {
				// Decrypt password
				const decryptedPassword = decrypt(conn.encryptedPassword);

				// Build connection config
				const config = buildProviderConfig(conn, decryptedPassword);

				// Create a temporary provider instance to test
				const provider = ProviderRegistry.createProvider(providerType, config);
				await provider.connect();
				await provider.disconnect();

				const latencyMs = Date.now() - startTime;

				logger.info(`[Connections] Saved connection test successful: ${conn.name} (${latencyMs}ms)`);
				return {
					success: true,
					message: "Connection successful",
					latencyMs,
				};
			} catch (error) {
				const latencyMs = Date.now() - startTime;
				const message = error instanceof Error ? error.message : "Unknown error";

				logger.warn(`[Connections] Saved connection test failed: ${conn.name} - ${message}`);
				return {
					success: false,
					message,
					latencyMs,
				};
			}
		}),

	/**
	 * Get connection credentials for the active connection (internal use)
	 * Returns decrypted credentials for provider initialization
	 */
	getActiveCredentials: publicProcedure.query(async () => {
		const conn = db
			.select()
			.from(connections)
			.where(eq(connections.isActive, true))
			.get();

		if (!conn) {
			return null;
		}

		try {
			const decryptedPassword = decrypt(conn.encryptedPassword);
			return {
				...toSafeConnection(conn),
				config: buildProviderConfig(conn, decryptedPassword),
			};
		} catch (error) {
			logger.error(`[Connections] Failed to decrypt password for connection ${conn.id}`, error);
			throw new Error("Failed to decrypt connection credentials");
		}
	}),
});
