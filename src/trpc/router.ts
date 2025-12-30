import { router } from "~/trpc/init";
import { userRouter } from "~/trpc/users";
import { postgresRouter } from "~/trpc/postgres";
import { sqliteRouter } from "~/trpc/sqlite";
import { providersRouter } from "~/trpc/providers";
import { explorerRouter } from "~/trpc/explorer";
import { connectionsRouter } from "~/trpc/connections";
import { historyRouter } from "~/trpc/history";
import { settingsRouter } from "~/trpc/settings";
import { filesystemRouter } from "~/trpc/filesystem";

export const trpcRouter = router({
	users: userRouter,
	postgres: postgresRouter,
	sqlite: sqliteRouter,
	providers: providersRouter,
	explorer: explorerRouter,
	connections: connectionsRouter,
	history: historyRouter,
	settings: settingsRouter,
	filesystem: filesystemRouter,
});

export type TRPCRouter = typeof trpcRouter;
