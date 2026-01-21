import { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { createTRPCClient } from "@trpc/client";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { DefaultCatchBoundary } from "~/components/default-catch-boundary";
import { NotFoundPage } from "~/components/not-found";
import { Toaster } from "~/components/ui/sonner";
import { ConnectionProvider } from "~/providers/connection-provider";
import { SettingsProvider } from "~/providers/settings-provider";
import { TableSelectionProvider } from "~/providers/table-selection-provider";
import { UserProvider } from "~/providers/user-provider";
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
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon_black.png",
				media: "(prefers-color-scheme: light)",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon_white.png",
				media: "(prefers-color-scheme: dark)",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32_black.png",
				media: "(prefers-color-scheme: light)",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32_white.png",
				media: "(prefers-color-scheme: dark)",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16_black.png",
				media: "(prefers-color-scheme: light)",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16_white.png",
				media: "(prefers-color-scheme: dark)",
			},
			{
				rel: "icon",
				href: "/favicon_black.ico",
				media: "(prefers-color-scheme: light)",
			},
			{
				rel: "icon",
				href: "/favicon_white.ico",
				media: "(prefers-color-scheme: dark)",
			},
			{ rel: "manifest", href: "/site.webmanifest" },
			{ rel: "preconnect", href: "https://fonts.googleapis.com", crossOrigin: "anonymous" },
			{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap",
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
