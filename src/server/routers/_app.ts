import { router } from "../trpc";
import { profileRouter } from "./profile";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";
import { researchRouter } from "./research";
import { touchpointsRouter } from "./touchpoints";
import { messagesRouter } from "./messages";
import { templatesRouter } from "./templates";
import { sendRouter } from "./send";
import { draftingRouter } from "./drafting";
import { sourcesRouter } from "./sources";

export const appRouter = router({
  profile: profileRouter,
  companies: companiesRouter,
  contacts: contactsRouter,
  research: researchRouter,
  touchpoints: touchpointsRouter,
  messages: messagesRouter,
  templates: templatesRouter,
  send: sendRouter,
  drafting: draftingRouter,
  sources: sourcesRouter,
});

export type AppRouter = typeof appRouter;
