import { router } from "~/trpc/init";
import { userRouter } from "~/trpc/users";
import { postgresRouter } from "~/trpc/postgres";
import { providersRouter } from "~/trpc/providers";
import { explorerRouter } from "~/trpc/explorer";
import { connectionsRouter } from "~/trpc/connections";
import { historyRouter } from "~/trpc/history";
import { settingsRouter } from "~/trpc/settings";

export const trpcRouter = router({
	users: userRouter,
	postgres: postgresRouter,
	providers: providersRouter,
	explorer: explorerRouter,
	connections: connectionsRouter,
	history: historyRouter,
	settings: settingsRouter,
});

export type TRPCRouter = typeof trpcRouter;
