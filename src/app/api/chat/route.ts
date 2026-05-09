import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { buildSystemPrompt } from "@/server/ai/prompts/system";
import { webSearchTool } from "@/server/ai/tools/web-search";
import { artifactTools } from "@/server/ai/tools/generate-artifact";
import { createReadArtifactTool, createReadAllArtifactsTool } from "@/server/ai/tools/read-artifact";
import { createEditPlanTool, createEditPrdTool } from "@/server/ai/tools/edit-artifact";
import { askFollowUpTool } from "@/server/ai/tools/ask-follow-up";
import { askOpenQuestionTool } from "@/server/ai/tools/ask-open-question";
import { proposeAndConfirmTool } from "@/server/ai/tools/propose-and-confirm";
import { chatLimiter, demoChatLimiter, getRateLimitIdentifier, rateLimitResponse, safeLimit } from "@/lib/rate-limit";
import { loadProjectArtifacts } from "@/server/services/project-context";
import { routeModel, temperatureFor } from "@/server/ai/model-router";

const DEMO_USER_ID = process.env.DEMO_USER_ID;

// Bump to 300s (5 min). gpt-5-pro and o3 often run 2-5 min for full artifacts;
// the previous 60s ceiling was killing responses mid-stream. Streaming still
// flows token-by-token to the browser during this window — maxDuration is just
// the upper bound on total function execution. Vercel Fluid Compute supports
// up to 800s if we ever need to push higher.
export const maxDuration = 300;

export async function POST(req: Request) {
  let userId: string | null = null;
  let isDemo = false;
  let isPlayground = false;

  const { userId: clerkUserId } = await auth();
  userId = clerkUserId;

  // Demo / Playground fallback: if no Clerk session, check guest cookies.
  // Both share DEMO_USER_ID; only /demo (showcase project) gets stricter rate
  // limits. /playground (evaluation/sandbox link) uses normal rate limits so
  // the visitor can actually generate things.
  if (!userId && DEMO_USER_ID) {
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get("hannibal-demo");
    const playgroundCookie = cookieStore.get("hannibal-playground");
    if (demoCookie?.value === "true") {
      userId = DEMO_USER_ID;
      isDemo = true;
    } else if (playgroundCookie?.value === "true") {
      userId = DEMO_USER_ID;
      isPlayground = true;
    }
  }

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Stricter rate limit for /demo only. Playground uses normal limit.
  const limiter = isDemo ? (demoChatLimiter ?? chatLimiter) : chatLimiter;
  if (limiter) {
    const id = getRateLimitIdentifier(userId, req);
    const { success, reset } = await safeLimit(limiter, id);
    if (!success) return rateLimitResponse(reset);
  }
  // Avoid unused-var lint on isPlayground while the value is reserved for future routing decisions
  void isPlayground;

  const body = await req.json();
  const {
    messages: rawMessages,
    activeView = "overview",
    selectedEntity = null,
    highlightedText = null,
    projectId,
    projectName,
    artifacts = [],
    model: requestedModel,
  } = body;

  // Route the model: explicit choice wins; "auto" (or unrecognized) → rule-based pick
  // based on active view + last user message intent (priorities/RICE → o3, quick edits
  // → gpt-5.4-mini, "deep/thorough" → gpt-5-pro, default → gpt-5.4).
  const lastUserMessage =
    [...(rawMessages as UIMessage[])].reverse().find((m) => m.role === "user") ??
    null;
  const lastUserText = lastUserMessage
    ? lastUserMessage.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
    : "";
  const model = routeModel(requestedModel, {
    activeView,
    messageText: lastUserText,
  });

  // Load saved project artifacts from DB to give AI persistent context
  let dbArtifacts: Awaited<ReturnType<typeof loadProjectArtifacts>> = [];
  if (projectId && typeof projectId === "string") {
    try {
      dbArtifacts = await loadProjectArtifacts(projectId);
    } catch {
      // DB unreachable — proceed without project context
    }
  }

  // Merge DB artifacts with any client-side (unpushed) artifacts
  const allArtifacts = [...dbArtifacts, ...artifacts];

  const systemPrompt = buildSystemPrompt({
    activeView,
    selectedEntity,
    highlightedText,
    projectName,
    artifacts: allArtifacts,
  });

  const modelMessages = await convertToModelMessages(
    rawMessages as UIMessage[]
  );

  const result = streamText({
    // openai.chat() uses the stateless Chat Completions API. The default
    // openai() factory uses the stateful Responses API, which echoes back
    // server-side item IDs (msg_..., fc_...) in providerMetadata. Those IDs
    // get persisted with the conversation and replayed on subsequent turns;
    // when OpenAI's item store evicts one, every following message in that
    // conversation 404s ("Item with id 'msg_...' not found"). The error is
    // masked by toUIMessageStreamResponse, so the client sees an empty 200
    // and the chat appears to stop responding. Chat Completions has no item
    // IDs and no such failure mode.
    model: openai.chat(model),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      webSearch: webSearchTool,
      askFollowUp: askFollowUpTool,
      askOpenQuestion: askOpenQuestionTool,
      proposeAndConfirm: proposeAndConfirmTool,
      ...artifactTools,
      readArtifact: createReadArtifactTool(allArtifacts),
      readAllArtifacts: createReadAllArtifactsTool(allArtifacts),
      editPlan: createEditPlanTool(userId),
      editPRD: createEditPrdTool(userId),
    },
    // Allow up to 8 tool-call → continuation cycles per turn. A common chain
    // is webSearch → askFollowUp → (after answers) proposeAndConfirm → generate
    // → summary, which is already 5 steps; this gives headroom for a second
    // tool round if the AI needs more research after the follow-up.
    stopWhen: stepCountIs(8),
    temperature: temperatureFor(model),
    maxOutputTokens: 16384,
    onError: ({ error }) => {
      console.error("[chat] streamText error:", error);
    },
  });

  // Surface stream errors to the client instead of letting the SDK swallow
  // them into an empty 200 response. Without this, any mid-stream failure
  // produces a ghost reply and the user has no signal to retry.
  return result.toUIMessageStreamResponse({
    onError: (error) =>
      error instanceof Error ? error.message : "An error occurred while generating a response.",
  });
}
