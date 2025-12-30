import { createFileRoute } from "@tanstack/react-router";
import { ConnectionManager } from "~/components/connection-manager";

export const Route = createFileRoute("/_layout/connections")({
	component: ConnectionsPage,
});

function ConnectionsPage() {
	return (
		<section className="max-w-4xl mx-auto">
			<ConnectionManager />
		</section>
	);
}
