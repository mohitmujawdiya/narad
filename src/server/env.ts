import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  CAREEROPS_PATH: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().optional().default(""),
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

export function requireOpenAIKey(): string {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing — set it in .env.local before invoking OpenAI");
  }
  return env.OPENAI_API_KEY;
}

export function requirePerplexityKey(): string {
  if (!env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY missing — set it in .env.local before invoking Perplexity");
  }
  return env.PERPLEXITY_API_KEY;
}
