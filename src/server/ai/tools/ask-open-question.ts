import { tool, jsonSchema } from "ai";

export const askOpenQuestionTool = tool({
  description:
    "Ask the user a single open-ended question that needs a paragraph-shaped answer — not a discrete pick from options. Use ONLY when (a) the answer is fundamentally prose (existing user research, anecdotes, constraints, story-shaped context) AND (b) you can't pre-frame meaningful options because you don't know enough about the user's specific context. If you can frame 2-4 concrete options, use askFollowUp instead. If you can make a defensible assumption from context so far, use proposeAndConfirm. Don't ask obvious questions — dig into the hard parts the user might not have considered.",
  inputSchema: jsonSchema<{
    question: string;
    header: string;
    placeholder?: string;
    context?: string;
  }>({
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "A complete question ending in '?' whose subject is the user, their situation, or their evidence — not the product or its capabilities. Examples: 'What user research have you done so far, and what did you learn?', 'Walk me through what your ideal user does on a typical Tuesday morning.', 'What's the existing solution your users patched together that you're trying to replace?'",
      },
      header: {
        type: "string",
        description:
          "A scannable chip label (≤12 characters) naming the dimension being asked about. Examples: 'Research', 'Context', 'Constraints', 'Story', 'Evidence'.",
      },
      placeholder: {
        type: "string",
        description:
          "Optional placeholder text for the textarea hinting at the kind of detail you want (e.g. 'Customer interviews, surveys, anecdotes...').",
      },
      context: {
        type: "string",
        description:
          "Optional 1-2 sentence context: WHY you're asking this question and what the answer will let you do. Helps the user understand why their effort to type is worth it.",
      },
    },
    required: ["question", "header"],
  }),
  // No execute — human-in-the-loop tool.
  // The client renders a textarea and provides the result via addToolOutput.
});
