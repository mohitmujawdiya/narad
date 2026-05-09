import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const DEMO_USER_ID = process.env.DEMO_USER_ID;

export type Context = {
  db: typeof db;
  userId: string | null;
  isDemo: boolean;
  isPlayground: boolean;
};

export async function createContext(): Promise<Context> {
  const { userId } = await auth();

  // Demo / Playground fallback: if no Clerk session, check the guest cookies.
  // Both share DEMO_USER_ID but the chat route applies different rate limits.
  if (!userId && DEMO_USER_ID) {
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get("hannibal-demo");
    const playgroundCookie = cookieStore.get("hannibal-playground");
    if (demoCookie?.value === "true") {
      return { db, userId: DEMO_USER_ID, isDemo: true, isPlayground: false };
    }
    if (playgroundCookie?.value === "true") {
      return { db, userId: DEMO_USER_ID, isDemo: false, isPlayground: true };
    }
  }

  return {
    db,
    userId,
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
