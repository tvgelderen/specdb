import fs from "fs";
import path from "path";
import logger from "~/lib/logging";
import { NODE_ENV } from "~/lib/environment/private";

const logsDir = path.join(process.cwd(), "logs");

export function initializeLogging(): void {
	const isProduction = NODE_ENV === "production";

	console.log("[LOGGING INIT] Starting logging initialization");

	try {
		if (isProduction) {
			fs.accessSync(logsDir, fs.constants.W_OK);
		}
	} catch (error) {
		console.error("[LOGGING INIT] Error during initialization:", error);
		throw new Error("Logging system initialization failed");
	}
}

export function cleanupOldLogs(daysToKeep: number = 30): void {
	const isProduction = NODE_ENV === "production";

	if (!isProduction || !fs.existsSync(logsDir)) {
		return;
	}

	try {
		const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
		const files = fs.readdirSync(logsDir);

		let cleanedCount = 0;
		for (const file of files) {
			const filePath = path.join(logsDir, file);
			const stats = fs.statSync(filePath);

			if (stats.mtime.getTime() < cutoffTime) {
				fs.unlinkSync(filePath);
				cleanedCount++;
			}
		}

		if (cleanedCount > 0) {
			logger.info("Cleaned up old log files", {
				filesRemoved: cleanedCount,
				daysToKeep,
				logsDirectory: logsDir,
			});
		}
	} catch (error) {
		logger.error(`Failed to cleanup old log files: ${JSON.stringify(error, null, 2)}`);
	}
}
