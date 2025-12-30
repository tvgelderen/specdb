import { initTRPC } from "@trpc/server";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { ZodError } from "zod/v4";

export const createContext = async ({ req, resHeaders }: FetchCreateContextFnOptions) => {
	return {
		req,
		resHeaders,
		headers: req.headers,
	};
};

const t = initTRPC.context<typeof createContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError: error.cause instanceof ZodError ? error.cause : null,
			},
		};
	},
});

export const router = t.router;
export const middleware = t.middleware;
export const procedure = t.procedure;
