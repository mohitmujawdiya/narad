import { router } from "../trpc";
import { projectRouter } from "./project";
import { planRouter } from "./plan";
import { prdRouter } from "./prd";
import { featureRouter } from "./feature";
import { personaRouter } from "./persona";
import { competitorRouter } from "./competitor";
import { roadmapRouter } from "./roadmap";
import { conversationRouter } from "./conversation";

export const appRouter = router({
  project: projectRouter,
  plan: planRouter,
  prd: prdRouter,
  feature: featureRouter,
  persona: personaRouter,
  competitor: competitorRouter,
  roadmap: roadmapRouter,
  conversation: conversationRouter,
});

export type AppRouter = typeof appRouter;
