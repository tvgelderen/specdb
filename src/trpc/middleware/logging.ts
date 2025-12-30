import { ZodError } from "zod/v4";
import logger from "~/lib/logging";
import { middleware } from "~/trpc/init";

export const logging = middleware(async ({ path, type, next }) => {
	logger.info(`[TRPC] Request ${type} ${path}`);

	const start = performance.now();
	const result = await next();
	const durationMs = performance.now() - start;

	if (!result.ok) {
		logger.error(`[TRPC] Error for ${type} ${path}: ${result.error.code} - ${result.error.message}`);

		if (result.error.cause instanceof ZodError) {
			logger.error(`[TRPC] Validation error for ${type} ${path}:`, result.error.cause);
		}
	}

	logger.info(`[TRPC] Response ${type} ${path} - duration: ${durationMs.toFixed(2)}ms`);

	return result;
});
