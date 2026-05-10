/**
 * JD-artifact generators (redesign-v2 Task 12).
 *
 * Three functions, each scoped to a single Pursuit + the singleton Profile:
 *   - generateJdEvaluation  → A-G markdown report, persisted to Pursuit.jdEvaluation
 *   - generateCvVariant     → 5 surgical edits + summary (JSON), persisted to Pursuit.cvVariant
 *   - generateCoverLetter   → subject + body (JSON), persisted to Pursuit.coverLetter
 *
 * Each requires the Pursuit to have jdMarkdown (these only make sense for jobs
 * with extracted JD content) and the Profile to have cvMarkdown. Each logs the
 * matching activity-log entry on success.
 *
 * The markdown evaluation is wrapped as `{markdown: "..."}` in the LLM
 * response so we can keep using the single `openaiJson` adapter; the wrapper
 * is unwrapped before persistence.
 */
import { z } from "zod";
import { db } from "../db";
import { logActivity } from "./activity-log";
import { openaiJson } from "./ai/openai-chat";
import {
  evaluateJdSystemPrompt,
  evaluateJdUserPrompt,
} from "./ai/prompts/evaluate-jd";
import {
  draftCvVariantSystemPrompt,
  draftCvVariantUserPrompt,
} from "./ai/prompts/draft-cv-variant";
import {
  draftCoverLetterSystemPrompt,
  draftCoverLetterUserPrompt,
} from "./ai/prompts/draft-cover-letter";

const MODEL = "gpt-5.5";

// ---------- Shared validation schemas ----------

const EvaluationWrapperSchema = z.object({
  markdown: z.string().min(1),
});

const CvVariantSchema = z.object({
  edits: z
    .array(
      z.object({
        section: z.string(),
        current: z.string(),
        proposed: z.string(),
        rationale: z.string(),
      }),
    )
    .min(1),
  summary: z.string().min(1),
});

export type CvVariantOutput = z.infer<typeof CvVariantSchema>;

const CoverLetterSchema = z.object({
  subject: z.string().nullable(),
  body: z.string().min(1),
});

export type CoverLetterOutput = z.infer<typeof CoverLetterSchema>;

// ---------- Internal helpers ----------

async function loadPursuitAndProfile(pursuitId: string) {
  const pursuit = await db.pursuit.findUniqueOrThrow({ where: { id: pursuitId } });
  if (!pursuit.jdMarkdown) {
    throw new Error(
      `Pursuit ${pursuitId} has no jdMarkdown; JD-artifact generators only work on job pursuits with extracted JD content.`,
    );
  }
  const profile = await db.profile.findUnique({ where: { id: "singleton" } });
  if (!profile?.cvMarkdown) {
    throw new Error(
      `Profile has no cvMarkdown; sync CareerOps in /settings before generating JD artifacts.`,
    );
  }
  return { pursuit, profile, jdMarkdown: pursuit.jdMarkdown, cvMarkdown: profile.cvMarkdown };
}

// ---------- Generators ----------

export async function generateJdEvaluation(pursuitId: string): Promise<string> {
  const { profile, jdMarkdown, cvMarkdown } = await loadPursuitAndProfile(pursuitId);

  const system = `${evaluateJdSystemPrompt()}

OUTPUT — return a single JSON object with one field, the full markdown report:
{
  "markdown": "<the entire A-G report + Global Score, in markdown>"
}
No prose, no fences, JSON only.`;
  const user = evaluateJdUserPrompt({
    jdMarkdown,
    cvMarkdown,
    narrative: profile.narrative,
  });

  const { data: raw } = await openaiJson<unknown>({
    system,
    user,
    model: MODEL,
    maxTokens: 4096,
  });

  const parsed = EvaluationWrapperSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`generateJdEvaluation: model returned malformed wrapper — ${parsed.error.message}`);
  }
  const markdown = parsed.data.markdown.trim();
  if (markdown.length < 50) {
    throw new Error(`generateJdEvaluation: evaluation suspiciously short (${markdown.length} chars).`);
  }

  await db.pursuit.update({
    where: { id: pursuitId },
    data: { jdEvaluation: markdown },
  });

  await logActivity({
    type: "jd-evaluated",
    pursuitId,
    payload: { length: markdown.length },
  });

  return markdown;
}

export async function generateCvVariant(pursuitId: string): Promise<CvVariantOutput> {
  const { jdMarkdown, cvMarkdown } = await loadPursuitAndProfile(pursuitId);

  const system = draftCvVariantSystemPrompt();
  const user = draftCvVariantUserPrompt({ jdMarkdown, cvMarkdown });

  const { data: raw } = await openaiJson<unknown>({
    system,
    user,
    model: MODEL,
    maxTokens: 2048,
  });

  const parsed = CvVariantSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`generateCvVariant: model returned invalid shape — ${parsed.error.message}`);
  }

  await db.pursuit.update({
    where: { id: pursuitId },
    data: { cvVariant: JSON.stringify(parsed.data) },
  });

  await logActivity({
    type: "cv-variant-generated",
    pursuitId,
    payload: { editCount: parsed.data.edits.length },
  });

  return parsed.data;
}

export async function generateCoverLetter(
  pursuitId: string,
  opts?: { hiringManagerName?: string },
): Promise<CoverLetterOutput> {
  const { pursuit, profile, jdMarkdown, cvMarkdown } = await loadPursuitAndProfile(pursuitId);

  const system = draftCoverLetterSystemPrompt();
  const user = draftCoverLetterUserPrompt({
    jdMarkdown,
    cvMarkdown,
    companyName: pursuit.companyName,
    narrative: profile.narrative,
    hiringManagerName: opts?.hiringManagerName ?? null,
  });

  const { data: raw } = await openaiJson<unknown>({
    system,
    user,
    model: MODEL,
    maxTokens: 2048,
  });

  const parsed = CoverLetterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`generateCoverLetter: model returned invalid shape — ${parsed.error.message}`);
  }

  await db.pursuit.update({
    where: { id: pursuitId },
    data: { coverLetter: JSON.stringify(parsed.data) },
  });

  await logActivity({
    type: "cover-letter-generated",
    pursuitId,
    payload: { hasSubject: parsed.data.subject !== null },
  });

  return parsed.data;
}
