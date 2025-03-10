#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as fs from 'fs';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  McpError,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { setupDocumentTools, handleDocumentToolCall } from "./document-operations.js";
import { setupSchemaTools, handleSchemaToolCall } from "./schema-operations.js";
// import { setAuth } from "./frappe-api.js"; // Removed setAuth import
import { FRAPPE_INSTRUCTIONS, getInstructions } from "./frappe-instructions.js";
import {
  findDocTypes,
  getModuleList,
  getDocTypesInModule,
  doesDocTypeExist,
  doesDocumentExist,
  getDocumentCount,
  getNamingSeriesInfo,
  getRequiredFields
} from "./frappe-helpers.js";

// Setup logging to file
const logPath = process.env.FRAPPE_MCP_LOG_PATH || './frappe-mcp-server.log';
const logFile = fs.createWriteStream(logPath, { flags: 'a' });
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [ERROR] ${args.join(' ')}\n`;
    logFile.write(logEntry);
    originalConsoleError(...args); // Still output to original console.error
};


// Define new tool handlers
async function handleHelperToolCall(request: any): Promise<any> {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [{ type: "text", text: "Missing arguments for tool call" }],
      isError: true,
    };
  }

  try {
    console.error(`Handling helper tool: ${name} with args:`, args);

    switch (name) {
      case "find_doctypes":
        const searchTerm = args.search_term || "";
        const options = {
          module: args.module,
          isTable: args.is_table,
          isSingle: args.is_single,
          isCustom: args.is_custom,
          limit: args.limit || 20
        };
        const doctypes = await findDocTypes(searchTerm, options);
        return {
          content: [{ type: "text", text: JSON.stringify(doctypes, null, 2) }],
        };

      case "get_module_list":
        const modules = await getModuleList();
        return {
          content: [{ type: "text", text: JSON.stringify(modules, null, 2) }],
        };

      case "get_doctypes_in_module":
        if (!args.module) {
          return {
            content: [{ type: "text", text: "Missing required parameter: module" }],
            isError: true,
          };
        }
        const moduleDocTypes = await getDocTypesInModule(args.module);
        return {
          content: [{ type: "text", text: JSON.stringify(moduleDocTypes, null, 2) }],
        };

      case "check_doctype_exists":
        if (!args.doctype) {
          return {
            content: [{ type: "text", text: "Missing required parameter: doctype" }],
            isError: true,
          };
        }
        const doctypeExists = await doesDocTypeExist(args.doctype);
        return {
          content: [{ type: "text", text: JSON.stringify({ exists: doctypeExists }, null, 2) }],
        };

      case "check_document_exists":
        if (!args.doctype || !args.name) {
          return {
            content: [{ type: "text", text: "Missing required parameters: doctype and name" }],
            isError: true,
          };
        }
        const documentExists = await doesDocumentExist(args.doctype, args.name);
        return {
          content: [{ type: "text", text: JSON.stringify({ exists: documentExists }, null, 2) }],
        };

      case "get_document_count":
        if (!args.doctype) {
          return {
            content: [{ type: "text", text: "Missing required parameter: doctype" }],
            isError: true,
          };
        }
        const count = await getDocumentCount(args.doctype, args.filters || {});
        return {
          content: [{ type: "text", text: JSON.stringify({ count }, null, 2) }],
        };

      case "get_naming_info":
        if (!args.doctype) {
          return {
            content: [{ type: "text", text: "Missing required parameter: doctype" }],
            isError: true,
          };
        }
        const namingInfo = await getNamingSeriesInfo(args.doctype);
        return {
          content: [{ type: "text", text: JSON.stringify(namingInfo, null, 2) }],
        };

      case "get_required_fields":
        if (!args.doctype) {
          return {
            content: [{ type: "text", text: "Missing required parameter: doctype" }],
            isError: true,
          };
        }
        const requiredFields = await getRequiredFields(args.doctype);
        return {
          content: [{ type: "text", text: JSON.stringify(requiredFields, null, 2) }],
        };

      case "get_api_instructions":
        if (!args.category || !args.operation) {
          return {
            content: [{ type: "text", text: "Missing required parameters: category and operation" }],
            isError: true,
          };
        }
        const instructions = getInstructions(args.category, args.operation);
        return {
          content: [{ type: "text", text: instructions }],
        };

      default:
        return {
          content: [{ type: "text", text: `Helper module doesn't handle tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`Error in helper tool ${name}:`, error);
    return {
      content: [{ type: "text", text: `Error in helper tool ${name}: ${(error as Error).message}` }],
      isError: true,
    };
  }
}

async function main() {
  console.error("Starting Frappe MCP server...");

  // Log current working directory
  console.error("Current working directory:", process.cwd());

  // Initialize the MCP server
  const server = new Server(
    {
      name: "frappe-mcp-server",
      version: "0.2.0", // Updated version
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Set up authentication if API key and secret are provided
  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;
  
  if (apiKey && apiSecret) {
    console.error("Setting up authentication with provided API key and secret");
    // setAuth(apiKey, apiSecret); // Removed setAuth call
  } else {
    console.error("Warning: No API key and secret provided. Some operations may fail.");
  }

  // Set up the tools and resources
  // We need to ensure each module correctly handles its own tools
  // and doesn't interfere with tools from other modules
  
  // Register schema resources only (not tools)
  setupSchemaTools(server);
  
  // Register a combined tools list handler that will override any previous handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Document tools with enhanced descriptions
        {
          name: "create_document",
          description: "Create a new document in Frappe",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "DocType name" },
              values: {
                type: "object",
                description: "Document field values. Required fields must be included. For Link fields, provide the exact document name. For Table fields, provide an array of row objects.",
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
              name: { type: "string", description: "Document name (case-sensitive)" },
              fields: {
                type: "array",
                items: { type: "string" },
                description: "Fields to retrieve (optional). If not specified, all fields will be returned.",
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
              name: { type: "string", description: "Document name (case-sensitive)" },
              values: {
                type: "object",
                description: "Document field values to update. Only include fields that need to be updated. For Table fields, provide the entire table data including row IDs for existing rows.",
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
              name: { type: "string", description: "Document name (case-sensitive)" },
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
                description: "Filters to apply (optional). Simple format: {\"field\": \"value\"} or with operators: {\"field\": [\">\", \"value\"]}. Available operators: =, !=, <, >, <=, >=, like, not like, in, not in, is, is not, between.",
                additionalProperties: true
              },
              fields: {
                type: "array",
                items: { type: "string" },
                description: "Fields to retrieve (optional). For better performance, specify only the fields you need.",
              },
              limit: {
                type: "number",
                description: "Maximum number of documents to retrieve (optional). Use with limit_start for pagination.",
              },
              limit_start: {
                type: "number",
                description: "Starting offset for pagination (optional). Use with limit for pagination.",
              },
              order_by: {
                type: "string",
                description: "Field to order by (optional). Format: \"field_name asc\" or \"field_name desc\".",
              },
            },
            required: ["doctype"],
          },
        },
        
        // Schema tools with enhanced descriptions
        {
          name: "get_doctype_schema",
          description:
            "Get the complete schema for a DocType including field definitions, validations, and linked DocTypes. Use this to understand the structure of a DocType before creating or updating documents.",
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
          description: "Get available options for a Link or Select field. For Link fields, returns documents from the linked DocType. For Select fields, returns the predefined options.",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "DocType name" },
              fieldname: { type: "string", description: "Field name" },
              filters: {
                type: "object",
                description: "Filters to apply to the linked DocType (optional, for Link fields only)",
                additionalProperties: true
              },
            },
            required: ["doctype", "fieldname"],
          },
        },
        
        // New helper tools
        {
          name: "find_doctypes",
          description: "Find DocTypes in the system matching a search term",
          inputSchema: {
            type: "object",
            properties: {
              search_term: { type: "string", description: "Search term to look for in DocType names" },
              module: { type: "string", description: "Filter by module name (optional)" },
              is_table: { type: "boolean", description: "Filter by table DocTypes (optional)" },
              is_single: { type: "boolean", description: "Filter by single DocTypes (optional)" },
              is_custom: { type: "boolean", description: "Filter by custom DocTypes (optional)" },
              limit: { type: "number", description: "Maximum number of results (optional, default 20)" },
            },
            required: [],
          },
        },
        {
          name: "get_module_list",
          description: "Get a list of all modules in the system",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "get_doctypes_in_module",
          description: "Get a list of DocTypes in a specific module",
          inputSchema: {
            type: "object",
            properties: {
              module: { type: "string", description: "Module name" },
            },
            required: ["module"],
          },
        },
        {
          name: "check_doctype_exists",
          description: "Check if a DocType exists in the system",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "DocType name to check" },
            },
            required: ["doctype"],
          },
        },
        {
          name: "check_document_exists",
          description: "Check if a document exists",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "DocType name" },
              name: { type: "string", description: "Document name to check" },
            },
            required: ["doctype", "name"],
          },
        },
        {
          name: "get_document_count",
          description: "Get a count of documents matching filters",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "DocType name" },
              filters: {
                type: "object",
                description: "Filters to apply (optional)",
                additionalProperties: true
              },
            },
            required: ["doctype"],
          },
        },
        {
          name: "get_naming_info",
          description: "Get the naming series information for a DocType",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "DocType name" },
            },
            required: ["doctype"],
          },
        },
        {
          name: "get_required_fields",
          description: "Get a list of required fields for a DocType",
          inputSchema: {
            type: "object",
            properties: {
              doctype: { type: "string", description: "DocType name" },
            },
            required: ["doctype"],
          },
        },
        {
          name: "get_api_instructions",
          description: "Get detailed instructions for using the Frappe API",
          inputSchema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Instruction category (DOCUMENT_OPERATIONS, SCHEMA_OPERATIONS, ADVANCED_OPERATIONS, BEST_PRACTICES)"
              },
              operation: {
                type: "string",
                description: "Operation name (e.g., CREATE, GET, UPDATE, DELETE, LIST, GET_DOCTYPE_SCHEMA, etc.)"
              },
            },
            required: ["category", "operation"],
          },
        },
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
      
      // Try helper tools
      if (name === "find_doctypes" || name === "get_module_list" ||
          name === "get_doctypes_in_module" || name === "check_doctype_exists" ||
          name === "check_document_exists" || name === "get_document_count" ||
          name === "get_naming_info" || name === "get_required_fields" ||
          name === "get_api_instructions") {
        console.error(`Routing to helper handler: ${name}`);
        return await handleHelperToolCall(request);
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