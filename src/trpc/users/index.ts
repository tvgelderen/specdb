import { router } from "~/trpc/init";
import { publicProcedure } from "~/trpc/procedures";

export const userRouter = router({
	me: publicProcedure.query(async () => {
		return null;
	}),
});
