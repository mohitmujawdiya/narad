import { router } from "../trpc";
import { profileRouter } from "./profile";

export const appRouter = router({
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;
