import { TRPCError } from "@trpc/server";
import logger from "~/lib/logging";
import { createContext, middleware } from "~/trpc/init";

function getClientIp(req: Request): string {
	const xForwardedFor = req.headers.get("x-forwarded-for");
	if (xForwardedFor) {
		const firstIp = xForwardedFor.split(",")[0]?.trim();
		if (firstIp) {
			return firstIp;
		}
	}

	const xRealIp = req.headers.get("x-real-ip");
	if (xRealIp?.trim()) {
		return xRealIp.trim();
	}

	const cfConnectingIp = req.headers.get("cf-connecting-ip");
	if (cfConnectingIp?.trim()) {
		return cfConnectingIp.trim();
	}

	return "unknown";
}

type RateLimitStore = Map<
	string,
	{
		count: number;
		resetAt: number;
	}
>;

const rateLimitStore: RateLimitStore = new Map();

interface RateLimitOptions {
	// The maximum number of requests allowed in the given window.
	limit: number;
	// The time window in seconds.
	windowInSeconds: number;
}

export const rateLimit = (opts: RateLimitOptions) => {
	return middleware(async ({ ctx, path, next }) => {
		const now = Date.now();
		const identifier = getIdentifier(ctx, path);
		const windowMs = opts.windowInSeconds * 1000;

		let rateLimitData = rateLimitStore.get(identifier);
		if (!rateLimitData || rateLimitData.resetAt < now) {
			rateLimitData = {
				count: 0,
				resetAt: now + windowMs,
			};
		}

		rateLimitData.count++;

		rateLimitStore.set(identifier, rateLimitData);

		ctx.resHeaders.set("X-RateLimit-Limit", opts.limit.toString());
		ctx.resHeaders.set("X-RateLimit-Remaining", (opts.limit - rateLimitData.count).toString());
		ctx.resHeaders.set("X-RateLimit-Reset", Math.ceil(rateLimitData.resetAt / 1000).toString());

		if (rateLimitData.count > opts.limit) {
			const resetIn = Math.ceil((rateLimitData.resetAt - now) / 1000);

			logger.warn("Rate limit exceeded", {
				identifier,
				path,
				limit: opts.limit,
				currentCount: rateLimitData.count,
				resetInSeconds: resetIn,
			});

			ctx.resHeaders.set("Retry-After", resetIn.toString());

			throw new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
			});
		}

		return next({ ctx });
	});
};

export const getIdentifier = (ctx: Awaited<ReturnType<typeof createContext>>, path: string) =>
	`${getClientIp(ctx.req)}:${path}`;
