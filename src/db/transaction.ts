import { db } from "~/db";
import logger from "~/lib/logging";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function transaction<T>(callback: (tx: Transaction) => Promise<T>, maxRetries: number = 3): Promise<T> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await db.transaction(callback);
		} catch (err: any) {
			logger.error(`[DB] Transaction failed (attempt ${attempt} of ${maxRetries})`, err);

			if (isRetryableError(err) && attempt < maxRetries) {
				const delay = Math.pow(2, attempt) * 100;
				await new Promise((r) => setTimeout(r, delay));
				continue;
			}

			throw err;
		}
	}

	throw new Error("Transaction failed after all retries");
}

function isRetryableError(err: { code?: string }) {
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
