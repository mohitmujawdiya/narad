import { router } from "../trpc";
import { profileRouter } from "./profile";
import { pursuitsRouter } from "./pursuits";

export const appRouter = router({
  profile: profileRouter,
  pursuits: pursuitsRouter,
});

export type AppRouter = typeof appRouter;
