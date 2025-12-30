import { createTRPCClient, httpBatchLink, httpBatchStreamLink } from "@trpc/client";
import superjson from "superjson";
import type { TRPCRouter } from "~/trpc/router";

export const trpc = createTRPCClient<TRPCRouter>({
	links: [
		httpBatchLink({
			url: "/api/trpc",
			transformer: superjson,
		}),
		httpBatchStreamLink({
			url: "/api/trpc",
			transformer: superjson,
		}),
	],
});
