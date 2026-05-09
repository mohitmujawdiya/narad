import { tool, jsonSchema } from "ai";
import { db } from "@/lib/db";

export function createEditPlanTool(userId: string) {
  return tool({
    description:
      "Edit an existing plan document in-place. Use this INSTEAD OF generatePlan when the user already has a saved plan and asks to modify, improve, expand, or update it. Output the COMPLETE document content — keep unchanged sections exactly verbatim, only modify what the user asked to change.",
    inputSchema: jsonSchema<{ planId: string; content: string }>({
      type: "object",
      properties: {
        planId: {
          type: "string",
          description: "Plan ID from the artifact context",
        },
        content: {
          type: "string",
          description:
            "Complete updated plan as markdown. Keep unchanged sections verbatim. Only modify, add, or remove what the user asked to change.",
        },
      },
      required: ["planId", "content"],
    }),
    execute: async ({ planId, content }) => {
      const plan = await db.plan.findUnique({
        where: { id: planId },
        select: { id: true, project: { select: { userId: true } } },
      });
      if (!plan || plan.project.userId !== userId) {
        return { status: "error", error: "Not found or unauthorized" };
      }

      await db.plan.update({ where: { id: planId }, data: { content } });
      return { status: "edited", documentType: "plan", documentId: planId };
    },
  });
}

export function createEditPrdTool(userId: string) {
  return tool({
    description:
      "Edit an existing PRD document in-place. Use this INSTEAD OF generatePRD when the user already has a saved PRD and asks to modify, improve, expand, or update it. Output the COMPLETE document content — keep unchanged sections exactly verbatim, only modify what the user asked to change.",
    inputSchema: jsonSchema<{ prdId: string; content: string }>({
      type: "object",
      properties: {
        prdId: {
          type: "string",
          description: "PRD ID from the artifact context",
        },
        content: {
          type: "string",
          description:
            "Complete updated PRD as markdown. Keep unchanged sections verbatim. Only modify, add, or remove what the user asked to change.",
        },
      },
      required: ["prdId", "content"],
    }),
    execute: async ({ prdId, content }) => {
      const prd = await db.pRD.findUnique({
        where: { id: prdId },
        select: { id: true, project: { select: { userId: true } } },
      });
      if (!prd || prd.project.userId !== userId) {
        return { status: "error", error: "Not found or unauthorized" };
      }

      await db.pRD.update({ where: { id: prdId }, data: { content } });
      return { status: "edited", documentType: "prd", documentId: prdId };
    },
  });
}
