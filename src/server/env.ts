import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  CAREEROPS_PATH: z.string().min(1).optional(),
  PERPLEXITY_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  GMAIL_CLIENT_ID: z.string().optional().default(""),
  GMAIL_CLIENT_SECRET: z.string().optional().default(""),
  GMAIL_REDIRECT_URI: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

export function requireAnthropicKey(): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing — set it in .env.local before invoking Claude");
  }
  return env.ANTHROPIC_API_KEY;
}

export function requirePerplexityKey(): string {
  if (!env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY missing — set it in .env.local before invoking Perplexity");
  }
  return env.PERPLEXITY_API_KEY;
}
