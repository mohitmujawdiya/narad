import { router } from "../trpc";
import { profileRouter } from "./profile";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";
import { touchpointsRouter } from "./touchpoints";
import { messagesRouter } from "./messages";
import { templatesRouter } from "./templates";

export const appRouter = router({
  profile: profileRouter,
  companies: companiesRouter,
  contacts: contactsRouter,
  touchpoints: touchpointsRouter,
  messages: messagesRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
