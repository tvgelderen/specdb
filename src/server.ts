import handler from "@tanstack/react-start/server-entry";
import { initializeEncryption } from "~/lib/encryption";
import logger from "~/lib/logging";
import { initializeLogging } from "~/lib/logging/init";

initializeLogging();
initializeEncryption();

process.on("uncaughtException", (error) => {
	logger.error("[SERVER] Uncaught Exception", { error });

	if (error && typeof error === "object" && "status" in error && "body" in error) {
		logger.warn("[SERVER] Handled uncaught exception", { error });
		return;
	}

	process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
	logger.error("[SERVER] Unhandled Rejection", { promise, reason });

	if (reason && typeof reason === "object" && "status" in reason && "body" in reason) {
		logger.warn("[SERVER] Handled rejection", { reason });
		return;
	}

	logger.error("[SERVER] Unhandled promise rejection");
});

export default {
	fetch(request: Request) {
		return handler.fetch(request, {
			context: {
				fromFetch: true,
			},
		});
	},
};
