#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { handleDocumentToolCall } from "./document-operations.js";
import { setupSchemaTools, handleSchemaToolCall } from "./schema-operations.js";
import { setAuth } from "./frappe-api.js";
async function main() {
    console.error("Starting Frappe MCP server...");
    // Initialize the MCP server
    const server = new Server({
        name: "frappe-mcp-server",
        version: "0.1.0",
    }, {
        capabilities: {
            resources: {},
            tools: {},
        },
    });
    // Set up authentication if API key and secret are provided
    const apiKey = process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET;
    if (apiKey && apiSecret) {
        console.error("Setting up authentication with provided API key and secret");
        setAuth(apiKey, apiSecret);
    }
    else {
        console.error("Warning: No API key and secret provided. Some operations may fail.");
    }
    // Set up the tools and resources
    // We need to ensure each module correctly handles its own tools
    // and doesn't interfere with tools from other modules
    // Register schema resources only (not tools)
    // We'll modify the setupSchemaTools function to only register resources
    setupSchemaTools(server);
    // Register a combined tools list handler that will override any previous handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                // Document tools
                {
                    name: "create_document",
                    description: "Create a new document in Frappe",
                    inputSchema: {
                        type: "object",
                        properties: {
                            doctype: { type: "string", description: "DocType name" },
                            values: {
                                type: "object",
                                description: "Document field values",
                                additionalProperties: true
                            },
                        },
                        required: ["doctype", "values"],
                    },
                },
                {
                    name: "get_document",
                    description: "Retrieve a document from Frappe",
                    inputSchema: {
                        type: "object",
                        properties: {
                            doctype: { type: "string", description: "DocType name" },
                            name: { type: "string", description: "Document name" },
                            fields: {
                                type: "array",
                                items: { type: "string" },
                                description: "Fields to retrieve (optional)",
                            },
                        },
                        required: ["doctype", "name"],
                    },
                },
                {
                    name: "update_document",
                    description: "Update an existing document in Frappe",
                    inputSchema: {
                        type: "object",
                        properties: {
                            doctype: { type: "string", description: "DocType name" },
                            name: { type: "string", description: "Document name" },
                            values: {
                                type: "object",
                                description: "Document field values to update",
                                additionalProperties: true
                            },
                        },
                        required: ["doctype", "name", "values"],
                    },
                },
                {
                    name: "delete_document",
                    description: "Delete a document from Frappe",
                    inputSchema: {
                        type: "object",
                        properties: {
                            doctype: { type: "string", description: "DocType name" },
                            name: { type: "string", description: "Document name" },
                        },
                        required: ["doctype", "name"],
                    },
                },
                {
                    name: "list_documents",
                    description: "List documents from Frappe with filters",
                    inputSchema: {
                        type: "object",
                        properties: {
                            doctype: { type: "string", description: "DocType name" },
                            filters: {
                                type: "object",
                                description: "Filters to apply (optional)",
                                additionalProperties: true
                            },
                            fields: {
                                type: "array",
                                items: { type: "string" },
                                description: "Fields to retrieve (optional)",
                            },
                            limit: {
                                type: "number",
                                description: "Maximum number of documents to retrieve (optional)",
                            },
                            limit_start: {
                                type: "number",
                                description: "Starting offset for pagination (optional)",
                            },
                            order_by: {
                                type: "string",
                                description: "Field to order by (optional)",
                            },
                        },
                        required: ["doctype"],
                    },
                },
                // Schema tools
                {
                    name: "get_doctype_schema",
                    description: "Get the complete schema for a DocType including field definitions, validations, and linked DocTypes",
                    inputSchema: {
                        type: "object",
                        properties: {
                            doctype: { type: "string", description: "DocType name" },
                        },
                        required: ["doctype"],
                    },
                },
                {
                    name: "get_field_options",
                    description: "Get available options for a Link or Select field",
                    inputSchema: {
                        type: "object",
                        properties: {
                            doctype: { type: "string", description: "DocType name" },
                            fieldname: { type: "string", description: "Field name" },
                            filters: {
                                type: "object",
                                description: "Filters to apply (optional)",
                                additionalProperties: true
                            },
                        },
                        required: ["doctype", "fieldname"],
                    },
                }
            ],
        };
    });
    // Add a central handler for CallToolRequestSchema that routes to the appropriate module
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name } = request.params;
        try {
            console.error(`Received tool call for: ${name}`);
            // Try schema tools first
            if (name === "get_doctype_schema" || name === "get_field_options") {
                console.error(`Routing to schema handler: ${name}`);
                return await handleSchemaToolCall(request);
            }
            // Try document tools next
            if (name === "create_document" || name === "get_document" ||
                name === "update_document" || name === "delete_document" ||
                name === "list_documents") {
                console.error(`Routing to document handler: ${name}`);
                return await handleDocumentToolCall(request);
            }
            // If no handler found, return an error
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
        }
        catch (error) {
            console.error(`Error handling tool ${name}:`, error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error handling tool ${name}: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    });
    // Set up error handling
    server.onerror = (error) => console.error("[MCP Error]", error);
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
        console.error("Shutting down Frappe MCP server...");
        await server.close();
        process.exit(0);
    });
    // Connect to the transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Frappe MCP server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map