import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

export type Context = {
  // Single-user app — no user identity yet. Could add later.
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
