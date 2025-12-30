import path from "path";
import { createLogger, format, transports } from "winston";
import { NODE_ENV } from "~/lib/environment/private";

const logsDir = path.join(process.cwd(), "logs");

const isProduction = NODE_ENV === "production";

const logFormat = format.combine(
	format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	format.errors({ stack: true }),
	format.json(),
	format.printf(({ timestamp, level, message, stack, ...meta }) => {
		let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

		if (Object.keys(meta).length > 0) {
			log += ` | Meta: ${JSON.stringify(meta)}`;
		}

		if (stack) {
			log += `\nStack: ${stack}`;
		}

		return log;
	}),
);

const consoleFormat = format.combine(
	format.colorize(),
	format.timestamp({ format: "HH:mm:ss" }),
	format.printf(({ timestamp, level, message, stack, ...meta }) => {
		let log = `${timestamp} [${level}]: ${message}`;

		if (Object.keys(meta).length > 0) {
			log += ` ${JSON.stringify(meta)}`;
		}

		if (stack) {
			log += `\n${stack}`;
		}

		return log;
	}),
);

const logger = createLogger({
	level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
	format: logFormat,
	transports: [],
});

const maxSize = 1024 * 1024 * 5; // 5MB

if (isProduction) {
	logger.add(
		new transports.File({
			filename: path.join(logsDir, "app.log"),
			maxsize: maxSize,
			maxFiles: 5,
			tailable: true,
		}),
	);

	logger.add(
		new transports.File({
			filename: path.join(logsDir, "error.log"),
			level: "error",
			maxsize: maxSize,
			maxFiles: 5,
			tailable: true,
		}),
	);
} else {
	logger.add(
		new transports.Console({
			format: consoleFormat,
		}),
	);
}

export default logger;
