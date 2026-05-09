import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      "⚠️  UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — rate limiting disabled"
    );
    return null;
  }

  return new Redis({ url, token });
}

const redis = createRedis();

export const chatLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "rl:chat",
    })
  : null;

// Demo: 30 messages per hour. Stricter than authenticated users (which get the
// chatLimiter at 20/min) but generous enough that an evaluator can actually
// explore — generating a plan, PRD, personas, competitors, features, RICE,
// roadmap takes ~7 calls. /playground uses the normal chatLimiter (no extra
// limit) since that's the "build something with your own idea" path.
export const demoChatLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "rl:demo-chat",
    })
  : null;

export const trpcLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "rl:trpc",
    })
  : null;

export function getRateLimitIdentifier(
  userId: string | null,
  request: Request
): string {
  if (userId) return userId;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "anonymous";
}

// Wrap limiter calls so an unreachable/misconfigured Redis fails open
// (allows the request through) instead of 500-ing every API call.
export async function safeLimit(
  limiter: Ratelimit | null,
  id: string
): Promise<{ success: boolean; reset: number }> {
  if (!limiter) return { success: true, reset: 0 };
  try {
    return await limiter.limit(id);
  } catch (err) {
    console.warn("Rate limiter unreachable — failing open:", err);
    return { success: true, reset: 0 };
  }
}

export function rateLimitResponse(reset: number): Response {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000);
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(Math.max(retryAfter, 1)),
    },
  });
}
