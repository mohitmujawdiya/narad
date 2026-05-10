import { router } from "../trpc";
import { profileRouter } from "./profile";
import { pursuitsRouter } from "./pursuits";
import { sourcesRouter } from "./sources";

export const appRouter = router({
  profile: profileRouter,
  pursuits: pursuitsRouter,
  sources: sourcesRouter,
});

export type AppRouter = typeof appRouter;
