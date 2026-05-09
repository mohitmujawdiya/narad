import { router } from "../trpc";

export const appRouter = router({
  // routers added in subsequent tasks
});

export type AppRouter = typeof appRouter;
