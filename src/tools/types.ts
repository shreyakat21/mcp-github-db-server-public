import type { z } from "zod";

// Erased form used wherever tools are stored/dispatched generically
// (the index.ts tool registry, arrays mixing different schemas, etc).
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (input: unknown) => Promise<unknown>;
}

interface TypedToolDefinition<Schema extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: Schema;
  handler: (input: z.infer<Schema>) => Promise<unknown>;
}

// Lets each tool declare a precisely-typed handler against its own schema,
// then erases that to the common ToolDefinition shape for storage/dispatch.
export function defineTool<Schema extends z.ZodType>(
  def: TypedToolDefinition<Schema>
): ToolDefinition {
  return def as ToolDefinition;
}
