#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createGithubTools } from "./tools/github.js";
import { createDatabaseTools } from "./tools/database.js";
import type { ToolDefinition } from "./tools/types.js";

const config = loadConfig();
const tools: ToolDefinition[] = [...createGithubTools(config), ...createDatabaseTools(config)];
const toolsByName = new Map(tools.map((t) => [t.name, t]));

const server = new Server(
  { name: "mcp-github-db-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema, { target: "draft-7" }),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = toolsByName.get(request.params.name);
  if (!tool) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    };
  }

  try {
    const args = tool.inputSchema.parse(request.params.arguments ?? {});
    const result = await tool.handler(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text", text: `Error calling ${request.params.name}: ${message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`mcp-github-db-server running on stdio (${tools.length} tools registered)`);
}

main().catch((error) => {
  console.error("Fatal error starting mcp-github-db-server:", error);
  process.exit(1);
});
