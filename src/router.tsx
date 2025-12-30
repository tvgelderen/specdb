import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import superjson from "superjson";
import { routeTree } from "~/routeTree.gen";
import { trpc } from "~/trpc";
import { TRPCProvider } from "~/trpc/react";

export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			dehydrate: { serializeData: superjson.stringify },
			hydrate: { deserializeData: superjson.parse },
			queries: {
				staleTime: 1000 * 60,
			},
		},
	});

	const router = createRouter({
		routeTree,
		defaultPreload: "intent",
		context: {
			queryClient,
			trpc,
		},
		Wrap: ({ children }) => (
			<TRPCProvider trpcClient={trpc} queryClient={queryClient}>
				{children}
			</TRPCProvider>
		),
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
}
