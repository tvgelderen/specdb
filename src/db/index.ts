import Database from "better-sqlite3";
import "dotenv/config";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { relations } from "~/db/relations";
import { DB_PATH } from "~/lib/environment/private";
import logger from "~/lib/logging";

const sqlite = new Database(DB_PATH);

sqlite.pragma("journal_mode = WAL");

export const db = drizzle({
	client: sqlite,
	relations,
	casing: "snake_case",
});

process.on("SIGTERM", () => {
	logger.info("[DB] Closing database...");
	sqlite.close();
	logger.info("[DB] Database closed.");
	process.exit(0);
});
