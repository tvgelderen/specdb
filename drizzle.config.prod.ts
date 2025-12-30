import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DB_PATH } from "~/lib/environment/private";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "sqlite",
	casing: "snake_case",
	dbCredentials: {
		url: DB_PATH,
	},
});
