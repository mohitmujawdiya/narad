import { router } from "../trpc";
import { profileRouter } from "./profile";
import { companiesRouter } from "./companies";

export const appRouter = router({
  profile: profileRouter,
  companies: companiesRouter,
});

export type AppRouter = typeof appRouter;
