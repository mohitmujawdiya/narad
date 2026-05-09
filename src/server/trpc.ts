import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@/lib/db";

// Narad is a single-user local app — no auth needed.
const SINGLE_USER_ID = "local-user";

export type Context = {
  db: typeof db;
  userId: string | null;
  isDemo: boolean;
  isPlayground: boolean;
};

export async function createContext(): Promise<Context> {
  return {
    db,
    userId: SINGLE_USER_ID,
    isDemo: false,
    isPlayground: false,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
