import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const DB_PATH = process.env.DB_PATH;
if (!DB_PATH) {
	throw new Error("DB_PATH environment variable is required");
}

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "sqlite",
	casing: "snake_case",
	dbCredentials: {
		url: DB_PATH,
	},
});
