import { tool, jsonSchema } from "ai";

export const askFollowUpTool = tool({
  description:
    "Ask the user 1-4 batched clarifying questions when the request has genuine ambiguity that only the user's preference or intent can resolve — and the cost of guessing wrong outweighs the cost of asking. Ask PROBLEM-FIRST: who specifically has the pain, what is the pain, what's the wedge that makes this the right answer. Business model, positioning, GTM, and stage are CONSEQUENCES of problem-solution fit, not inputs — only ask about them after the user has articulated who they're serving and what's broken about the current alternative. Skip when the request already specifies the criteria, when web research can resolve it, or when the answer is obvious from context. Don't ask obvious questions — dig into the hard parts the user might not have considered. Pack related clarifications into a single call so the user answers in one pass instead of ping-ponging.",
  inputSchema: jsonSchema<{
    questions: Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description: string }>;
      multiSelect: boolean;
    }>;
  }>({
    type: "object",
    properties: {
      questions: {
        type: "array",
        description:
          "1-4 clarifying questions. Pack all the clarifications you need into one call — do not ping-pong sequential single-question rounds.",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description:
                "A complete question ending in '?' whose SUBJECT is the user and their pain or behavior — not the product, the AI, or its capabilities. Order of priority: (1) who specifically has the pain, (2) what is the pain, (3) why they'd switch from their current alternative (the wedge), (4) plan type or scope, (5) only when problem-solution is clear: business model / positioning / GTM / stage. BANNED question forms: 'What unique AI capability will differentiate...?', 'What features should the app focus on?', 'What's the key differentiator?', 'What makes this app special?', 'What should the AI do?' — these are feature-shopping in disguise and invite hollow option lists. If your question's subject is the product/AI/capabilities, rewrite it so the subject is the user.",
            },
            header: {
              type: "string",
              description:
                "A scannable chip label (≤12 characters) naming the dimension being asked about. Examples: 'Audience', 'GTM', 'Scope', 'Stage', 'Positioning', 'Plan type', 'Business'.",
            },
            options: {
              type: "array",
              description:
                "2-4 options. Quality bar — each option must: (1) name something CONCRETE (real competitor, real archetype, real business model), not abstract qualifiers; (2) have a description that explains how the artifact CHANGES if this is picked (what it prioritizes, deprioritizes, what scope/structure shifts) — never a restatement of the label; (3) produce a structurally different artifact than the other options (distinctness check — if two options would produce near-identical plans, collapse them or pick a higher-impact dimension). NEVER include 'Other' as an option — the UI auto-injects a free-text fallback. If you have a defensible recommendation given the context so far, place it first and append ' (Recommended)' to its label.",
              minItems: 2,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  label: {
                    type: "string",
                    description:
                      "Concrete 2-12 word name. For problem-first questions, name a USER + their PAIN ('Strength athletes plateaued by generic programs', 'Returning-to-fitness adults intimidated by gym apps'). For wedge questions, name the INSIGHT ('AI periodizes based on recovery markers'). Avoid abstract market labels ('Premium positioning'), MBA buckets ('VC-backed Peloton competitor'), and feature names ('Workout tracking'). Append ' (Recommended)' if this is the recommended option (which must then be first in the list).",
                  },
                  description: {
                    type: "string",
                    description:
                      "1-2 sentences explaining how the artifact's structure, priorities, and scope change if this is chosen — and what it gives up. NOT a restatement of the label, NOT a feature description. Reference real numbers (timeline, team size, TAM) only when defensible — no false precision.",
                  },
                },
                required: ["label", "description"],
              },
            },
            multiSelect: {
              type: "boolean",
              description:
                "true when the answers compose (audience segments, GTM channels, persona archetypes, comparison axes — the user can pick several and the artifact accommodates all). false when the answers are mutually exclusive (positioning, business model, stage, plan type — picking one excludes the others). Required.",
            },
          },
          required: ["question", "header", "options", "multiSelect"],
        },
      },
    },
    required: ["questions"],
  }),
  // No execute — human-in-the-loop tool.
  // The client renders questions and provides the result via addToolOutput.
});
