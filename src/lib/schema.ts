/**
 * Workaround for AI SDK v6 + Zod v4 tool schema bug.
 * 
 * The AI SDK v6 core expects `inputSchema` (not `parameters`) and
 * the Zod v4 → JSON Schema conversion in provider-utils is broken.
 * This creates tool definitions with raw JSON Schema that work correctly.
 */
const schemaSymbol = Symbol.for("vercel.ai.schema");

function schema<T>(jsonSchema: Record<string, unknown>) {
  return {
    [schemaSymbol]: true,
    jsonSchema,
    validate: (value: unknown) =>
      ({ success: true, value: value as T }) as const,
  };
}

export function defineTool<TParams, TResult>({
  description,
  schema: jsonSchemaObj,
  execute,
}: {
  description: string;
  schema: Record<string, unknown>;
  execute: (params: TParams) => Promise<TResult>;
}) {
  return {
    description,
    inputSchema: schema<TParams>(jsonSchemaObj),
    execute,
  };
}
