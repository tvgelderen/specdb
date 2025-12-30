import { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { createTRPCClient } from "@trpc/client";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { DefaultCatchBoundary } from "~/components/default-catch-boundary";
import { NotFoundPage } from "~/components/not-found";
import { Toaster } from "~/components/ui/sonner";
import { UserProvider } from "~/providers/user-provider";
import { ConnectionProvider } from "~/providers/connection-provider";
import { SettingsProvider } from "~/providers/settings-provider";
import { TableSelectionProvider } from "~/providers/table-selection-provider";
import appCss from "~/styles/app.css?url";
import { TRPCRouter } from "~/trpc/router";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	trpc: ReturnType<typeof createTRPCClient<TRPCRouter>>;
}>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "SpecDB",
			},
		],
		links: [
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap",
			},
			{ rel: "stylesheet", href: appCss },
		],
	}),
	errorComponent: (props) => {
		return (
			<RootDocument>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFoundPage />,
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="h-screen w-full">
				<UserProvider>
					<ConnectionProvider>
						<SettingsProvider>
							<TableSelectionProvider>
								<ThemeProvider
									attribute="class"
									defaultTheme="light"
									enableSystem
									disableTransitionOnChange
								>
									{children}
									<Scripts />
								</ThemeProvider>
							</TableSelectionProvider>
						</SettingsProvider>
					</ConnectionProvider>
				</UserProvider>

				<Toaster richColors />
			</body>
		</html>
	);
}
