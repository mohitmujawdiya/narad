import { tool, jsonSchema } from "ai";

export const proposeAndConfirmTool = tool({
  description:
    "Commit to a defensible assumption and ask the user to CONFIRM, REFINE, or REPLACE it. Use this as the DEFAULT clarification mechanism whenever you have enough context to make a defensible guess about a strategic dimension — it's more respectful of the user's time than asking them to pick from options or write a paragraph, because it shows you listened and made a decision they can correct. Examples of when to use: after the user has answered 1-2 askFollowUp rounds and you can infer the rest; when the conversation history makes the strategic direction clear; when artifacts in the project already imply the answer. Don't use for trivial points, and don't use to seek consent (use plain text for 'shall I proceed?').",
  inputSchema: jsonSchema<{
    header: string;
    summary: string;
    reasoning: string;
    implications: string[];
  }>({
    type: "object",
    properties: {
      header: {
        type: "string",
        description:
          "A scannable chip label (≤12 characters) naming the dimension. Examples: 'Wedge', 'Audience', 'Scope', 'Stage', 'Plan type'.",
      },
      summary: {
        type: "string",
        description:
          "ONE concrete sentence stating the assumption. Specific, falsifiable, and named — not abstract. GOOD: 'The wedge is strength athletes plateaued by generic programs, with AI periodization based on recovery markers.' BAD: 'The wedge is some kind of advanced fitness experience.'",
      },
      reasoning: {
        type: "string",
        description:
          "2-3 sentences explaining WHY you're proposing this. Cite specific evidence: what the user said, what artifacts in the project imply, what web research surfaced. The reasoning is what lets the user assess whether you actually listened.",
      },
      implications: {
        type: "array",
        description:
          "2-4 short bullets stating what this assumption means for the artifact you're about to build — what it prioritizes, what it deprioritizes, what scope/structure shifts. These are the CONSEQUENCES of saying 'confirm'. Each bullet should be specific enough that the user could disagree with one part of the proposal without rejecting the whole thing.",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "string",
        },
      },
    },
    required: ["header", "summary", "reasoning", "implications"],
  }),
  // No execute — human-in-the-loop tool.
  // The client renders the proposal with three actions (Confirm / Refine / Replace)
  // and provides the result via addToolOutput.
});
