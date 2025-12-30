import { useRouter } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export function NotFoundPage({ children }: { children?: any }) {
	const router = useRouter();

	return (
		<div className="w-screen h-screen flex flex-col gap-8 justify-center items-center bg-background">
			<div className="text-gray-600 dark:text-gray-400 text-lg">
				{children || <p>The page you are looking for does not exist.</p>}
			</div>
			<div className="space-x-4">
				<Button onClick={() => window.history.back()}>
					<ArrowLeft /> Go back
				</Button>
				<Button onClick={() => router.history.push("/")} variant="outline">
					<Home />
					Home
				</Button>
			</div>
		</div>
	);
}

export function NotFoundComponent({ children }: { children?: any }) {
	const router = useRouter();

	return (
		<div className="size-full flex flex-col gap-8 justify-center items-center bg-transparent text-center">
			<div className="text-gray-600 dark:text-gray-400 text-lg">
				{children || <p>The page you are looking for does not exist.</p>}
			</div>
			<div className="space-x-4">
				<Button onClick={() => window.history.back()}>
					<ArrowLeft /> Go back
				</Button>
				<Button onClick={() => router.history.push("/")} variant="outline">
					<Home />
					Home
				</Button>
			</div>
		</div>
	);
}
