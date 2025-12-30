import type { DbProviderEnvelope, ResponseError, ResponseMeta } from "./types";

/**
 * Create a success envelope with data
 */
export function createSuccessEnvelope<T>(
	data: T,
	provider: string,
	version: string,
	duration?: number
): DbProviderEnvelope<T> {
	return {
		data,
		meta: createMeta(provider, version, duration),
		errors: [],
	};
}

/**
 * Create an error envelope
 */
export function createErrorEnvelope<T = null>(
	error: Error | ResponseError,
	provider: string,
	version: string,
	duration?: number
): DbProviderEnvelope<T> {
	const responseError: ResponseError =
		error instanceof Error
			? {
					code: "PROVIDER_ERROR",
					message: error.message,
					stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
				}
			: error;

	return {
		data: null,
		meta: createMeta(provider, version, duration),
		errors: [responseError],
	};
}

/**
 * Create response metadata
 */
export function createMeta(provider: string, version: string, duration?: number): ResponseMeta {
	return {
		timestamp: Date.now(),
		duration,
		provider,
		version,
	};
}

/**
 * Helper to wrap an async function and automatically create envelopes
 */
export async function withEnvelope<T>(
	fn: () => Promise<T>,
	provider: string,
	version: string
): Promise<DbProviderEnvelope<T>> {
	const start = performance.now();
	try {
		const data = await fn();
		const duration = performance.now() - start;
		return createSuccessEnvelope(data, provider, version, duration);
	} catch (error) {
		const duration = performance.now() - start;
		return createErrorEnvelope<T>(error as Error, provider, version, duration);
	}
}

/**
 * Check if an envelope represents a successful response
 */
export function isSuccess<T>(envelope: DbProviderEnvelope<T>): envelope is DbProviderEnvelope<T> & { data: T } {
	return envelope.errors.length === 0 && envelope.data !== null;
}

/**
 * Check if an envelope represents an error response
 */
export function isError<T>(envelope: DbProviderEnvelope<T>): boolean {
	return envelope.errors.length > 0;
}

/**
 * Get the first error from an envelope, or undefined if no errors
 */
export function getFirstError<T>(envelope: DbProviderEnvelope<T>): ResponseError | undefined {
	return envelope.errors[0];
}

/**
 * Unwrap an envelope, throwing an error if the envelope contains errors
 */
export function unwrap<T>(envelope: DbProviderEnvelope<T>): T {
	if (envelope.errors.length > 0) {
		const firstError = envelope.errors[0];
		const error = new Error(firstError.message);
		error.name = firstError.code;
		throw error;
	}
	return envelope.data as T;
}

/**
 * Error codes for common provider errors
 */
export const ErrorCodes = {
	// Connection errors
	CONNECTION_FAILED: "CONNECTION_FAILED",
	CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",
	CONNECTION_REFUSED: "CONNECTION_REFUSED",
	AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",

	// Query errors
	QUERY_FAILED: "QUERY_FAILED",
	QUERY_TIMEOUT: "QUERY_TIMEOUT",
	SYNTAX_ERROR: "SYNTAX_ERROR",
	PERMISSION_DENIED: "PERMISSION_DENIED",

	// Data errors
	CONSTRAINT_VIOLATION: "CONSTRAINT_VIOLATION",
	DUPLICATE_KEY: "DUPLICATE_KEY",
	FOREIGN_KEY_VIOLATION: "FOREIGN_KEY_VIOLATION",
	NOT_NULL_VIOLATION: "NOT_NULL_VIOLATION",

	// Provider errors
	PROVIDER_ERROR: "PROVIDER_ERROR",
	CAPABILITY_NOT_SUPPORTED: "CAPABILITY_NOT_SUPPORTED",
	PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",

	// Transaction errors
	TRANSACTION_FAILED: "TRANSACTION_FAILED",
	DEADLOCK_DETECTED: "DEADLOCK_DETECTED",
	SERIALIZATION_FAILURE: "SERIALIZATION_FAILURE",

	// Validation errors
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Create a typed error for provider responses
 */
export function createProviderError(
	code: ErrorCode,
	message: string,
	details?: Record<string, unknown>
): ResponseError {
	return {
		code,
		message,
		details,
		stack: process.env.NODE_ENV === "development" ? new Error().stack : undefined,
	};
}
