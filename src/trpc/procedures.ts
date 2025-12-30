import { procedure } from "~/trpc/init";
import { logging } from "~/trpc/middleware/logging";
import { rateLimit } from "~/trpc/middleware/rate-limit";

const baseProcedure = procedure.use(logging).use(
	rateLimit({
		// Very generous rate limits for local-only application
		limit: 10000,
		windowInSeconds: 60,
	}),
);

export const publicProcedure = baseProcedure;
