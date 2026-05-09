import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "@clerk/nextjs/server";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";
import { trpcLimiter, getRateLimitIdentifier, rateLimitResponse, safeLimit } from "@/lib/rate-limit";

async function handler(req: Request) {
  if (trpcLimiter) {
    const { userId } = await auth();
    const id = getRateLimitIdentifier(userId, req);
    const { success, reset } = await safeLimit(trpcLimiter, id);
    if (!success) return rateLimitResponse(reset);
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      console.error(`[tRPC error] ${path}:`, error);
      if (error.cause) console.error("  cause:", error.cause);
      if (error.stack) console.error("  stack:", error.stack);
    },
  });
}

export { handler as GET, handler as POST };
