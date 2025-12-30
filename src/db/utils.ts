import { sql } from "drizzle-orm";

export const sqlNow = sql`datetime('now')`;
