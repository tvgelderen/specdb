import { defineRelations } from "drizzle-orm";
import * as schema from "~/db/schema";

export const relations = defineRelations(schema, (r) => ({
	// Connections has many query history entries
	connections: {
		queryHistory: r.many.queryHistory(),
	},
	// Query history belongs to a connection
	queryHistory: {
		connection: r.one.connections({
			from: r.queryHistory.connectionId,
			to: r.connections.id,
		}),
	},
}));
