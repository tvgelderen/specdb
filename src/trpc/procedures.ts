import { procedure } from "~/trpc/init";
import { logging } from "~/trpc/middleware/logging";
import { rateLimit } from "~/trpc/middleware/rate-limit";

const baseProcedure = procedure.use(logging).use(
	rateLimit({
		limit: 100,
		windowInSeconds: 60,
	}),
);

export const publicProcedure = baseProcedure;
