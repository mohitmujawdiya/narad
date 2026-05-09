// Model routing engine — picks the right OpenAI model for each request based on
// recent message intent and the user's "Auto" / explicit choice.
//
// NOTE: gpt-5-pro and o3 are TEMPORARILY DISABLED. They routinely take 2-5
// minutes to generate full artifacts, and Vercel Hobby caps function execution
// at 60s. Re-enable when you upgrade to Vercel Pro (300s default, 800s with
// Fluid Compute) by:
//   1. adding "gpt-5-pro" and "o3" back to ALLOWED_MODELS below
//   2. adding them back to MODEL_OPTIONS in ai-panel.tsx
//   3. uncommenting the REASONING_VIEWS / REASONING_KEYWORDS / HIGH_QUALITY_KEYWORDS
//      branches in routeModel()
//
// While disabled, all "auto" traffic stays on the fast gpt-5.4 family —
// gpt-5.4-mini for quick edits, gpt-5.4 for everything else.

export const ALLOWED_MODELS = [
  "auto",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-4o",
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export const DEFAULT_MODEL: Exclude<AllowedModel, "auto"> = "gpt-5.4";

type RoutingContext = {
  activeView?: string;
  messageText?: string;
};

const QUICK_EDIT_KEYWORDS =
  /\b(refine|edit|polish|tweak|adjust|small change|quick fix|update this|change the|fix the|reword|rephrase|tidy)\b/i;

export function routeModel(
  requested: string | undefined,
  ctx: RoutingContext = {},
): Exclude<AllowedModel, "auto"> {
  // Explicit override (anything that's a real model id wins).
  if (
    requested &&
    requested !== "auto" &&
    (ALLOWED_MODELS as readonly string[]).includes(requested)
  ) {
    return requested as Exclude<AllowedModel, "auto">;
  }

  // Auto routing — gpt-5.4 family only until pro/o3 are re-enabled.
  const text = ctx.messageText ?? "";
  if (QUICK_EDIT_KEYWORDS.test(text)) {
    return "gpt-5.4-mini";
  }
  return DEFAULT_MODEL;
}

// Some models don't accept the standard temperature parameter. The o-series
// reasoning models reject it, and the GPT-5 family is also reasoning-based and
// rejects it. Only legacy GPT-4 / GPT-4o accept temperature.
export function temperatureFor(
  model: Exclude<AllowedModel, "auto">,
): number | undefined {
  if (model.startsWith("o")) return undefined; // o3, o4-mini, etc.
  if (model.startsWith("gpt-5")) return undefined; // gpt-5, gpt-5.4, gpt-5-pro, etc.
  return 0.7;
}
