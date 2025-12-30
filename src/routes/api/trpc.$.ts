import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "~/trpc/init";
import { trpcRouter } from "~/trpc/router";

export const Route = createFileRoute("/api/trpc/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				return fetchRequestHandler({
					req: request,
					router: trpcRouter,
					endpoint: "/api/trpc",
					createContext: async (opts) => {
						return createContext({
							req: request,
							resHeaders: opts.resHeaders,
							info: opts.info,
						});
					},
				});
			},
			POST: async ({ request }) => {
				return fetchRequestHandler({
					req: request,
					router: trpcRouter,
					endpoint: "/api/trpc",
					createContext: async (opts) => {
						return createContext({
							req: request,
							resHeaders: opts.resHeaders,
							info: opts.info,
						});
					},
				});
			},
		},
	},
});
