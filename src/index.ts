#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleCallMethodToolCall } from "./document-operations.js";
import { setupDocumentTools, handleDocumentToolCall, DOCUMENT_TOOLS } from "./document-operations.js";
import { setupSchemaTools, handleSchemaToolCall, SCHEMA_TOOLS } from "./schema-operations.js";
import { getInstructions, HELPER_TOOLS } from "./frappe-instructions.js";
import { handleHelperToolCall } from "./index-helpers.js"; // Moved helper tool handlers to a separate file

async function main() {
  console.error("Starting Frappe MCP server...");
  console.error("Current working directory:", process.cwd());

  const server = new Server(
    {
      name: "frappe-mcp-server",
      version: "0.2.13",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;

  if (apiKey && apiSecret) {
    console.error("Setting up authentication with provided API key and secret");
  } else {
    console.error("Warning: No API key and secret provided. Some operations may fail.");
  }

  setupSchemaTools(server);
  setupDocumentTools(server);


  // Centralized tool registration
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      {
        name: "call_method",
        description: "Execute a whitelisted Frappe method",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", description: "Method name to call (whitelisted)" },
            params: {
              type: "object",
              description: "Parameters to pass to the method (optional)",
              additionalProperties: true
            },
          },
          required: ["method"],
        },
      },
      ...DOCUMENT_TOOLS,
      ...SCHEMA_TOOLS,
      ...HELPER_TOOLS,
    ];
    return { tools };
  });

  // Centralized tool call handling
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    try {
      console.error(`Received tool call for: ${name}`);

      if (name === "call_method") {
        console.error(`Routing to call_method handler: ${name}`);
        return await handleCallMethodToolCall(request);
      }

      if (DOCUMENT_TOOLS.find(tool => tool.name === name)) {
        console.error(`Routing to document handler: ${name}`);
        return await handleDocumentToolCall(request);
      }

      if (SCHEMA_TOOLS.find((tool: { name: string }) => tool.name === name)) {
        console.error(`Routing to schema handler: ${name}`);
        return await handleSchemaToolCall(request);
      }

      if (HELPER_TOOLS.find((tool: { name: string }) => tool.name === name)) {
        console.error(`Routing to helper handler: ${name}`);
        return await handleHelperToolCall(request);
      }


      console.error(`No handler found for tool: ${name}`);
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    } catch (error) {
      console.error(`Error handling tool ${name}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error handling tool ${name}: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.onerror = (error) => console.error("[MCP Error]", error);

  process.on("SIGINT", async () => {
    console.error("Shutting down Frappe MCP server...");
    await server.close();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Frappe MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});