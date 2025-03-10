import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getDocTypeSchema,
  getFieldOptions,
  FrappeApiError,
  getAllDocTypes,
  getAllModules
} from "./frappe-api.js";
import { formatFilters } from "./frappe-helpers.js";

/**
 * Format error response with detailed information
 */
function formatErrorResponse(error: any, operation: string): any {
  console.error(`Error in ${operation}:`, error);
  
  let errorMessage = `Error in ${operation}: ${error.message || 'Unknown error'}`;
  let errorDetails = null;
  
  if (error instanceof FrappeApiError) {
    errorMessage = error.message;
    errorDetails = {
      statusCode: error.statusCode,
      endpoint: error.endpoint,
      details: error.details
    };
  }
  
  return {
    content: [
      {
        type: "text",
        text: errorMessage,
      },
      ...(errorDetails ? [
        {
          type: "text",
          text: `\nDetails: ${JSON.stringify(errorDetails, null, 2)}`,
        }
      ] : [])
    ],
    isError: true,
  };
}

// Export a handler function for schema tool calls
export async function handleSchemaToolCall(request: any): Promise<any> {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [
        {
          type: "text",
          text: "Missing arguments for tool call",
        },
      ],
      isError: true,
    };
  }

  try {
    console.error(`Handling schema tool: ${name} with args:`, args);

    if (name === "get_doctype_schema") {
      const doctype = args.doctype as string;
      if (!doctype) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameter: doctype",
            },
          ],
          isError: true,
        };
      }
      
      try {
        const schema = await getDocTypeSchema(doctype);
        
        // Add a summary of the schema for easier understanding
        const fieldTypes = schema.fields.reduce((acc: Record<string, number>, field: any) => {
          acc[field.fieldtype] = (acc[field.fieldtype] || 0) + 1;
          return acc;
        }, {});
        
        const requiredFields = schema.fields
          .filter((field: any) => field.required)
          .map((field: any) => field.fieldname);
        
        const summary = {
          name: schema.name,
          module: schema.module,
          isSingle: schema.issingle,
          isTable: schema.istable,
          isCustom: schema.custom,
          autoname: schema.autoname,
          fieldCount: schema.fields.length,
          fieldTypes: fieldTypes,
          requiredFields: requiredFields,
          permissions: schema.permissions.length,
        };
        
        return {
          content: [
            {
              type: "text",
              text: `Schema Summary:\n${JSON.stringify(summary, null, 2)}\n\nFull Schema:\n${JSON.stringify(schema, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `get_doctype_schema(${doctype})`);
      }
    } else if (name === "get_field_options") {
      const doctype = args.doctype as string;
      const fieldname = args.fieldname as string;
      
      if (!doctype || !fieldname) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameters: doctype and fieldname are required",
            },
          ],
          isError: true,
        };
      }
      
      const filters = args.filters as Record<string, any> | undefined;
      const formattedFilters = filters ? formatFilters(filters) : undefined;
      
      try {
        // First get the field metadata to understand what we're dealing with
        const schema = await getDocTypeSchema(doctype);
        const field = schema.fields.find((f: any) => f.fieldname === fieldname);
        
        if (!field) {
          return {
            content: [
              {
                type: "text",
                text: `Field ${fieldname} not found in DocType ${doctype}`,
              },
            ],
            isError: true,
          };
        }
        
        // Get the options
        const options = await getFieldOptions(doctype, fieldname, formattedFilters);
        
        // Add field metadata to the response
        const fieldInfo = {
          fieldname: field.fieldname,
          label: field.label,
          fieldtype: field.fieldtype,
          required: field.required,
          description: field.description,
          options: field.options,
        };
        
        return {
          content: [
            {
              type: "text",
              text: `Field Information:\n${JSON.stringify(fieldInfo, null, 2)}\n\nAvailable Options (${options.length}):\n${JSON.stringify(options, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `get_field_options(${doctype}, ${fieldname})`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Schema operations module doesn't handle tool: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    return formatErrorResponse(error, `schema_operations.${name}`);
  }
}

export function setupSchemaTools(server: Server): void {
  // We no longer register tools here, only resources
  // Tools are now registered in the central handler in index.ts

  // Register schema resources
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: "schema://{doctype}",
        name: "DocType Schema",
        mimeType: "application/json",
        description:
          "Schema information for a DocType including field definitions and validations",
      },
      {
        uriTemplate: "schema://{doctype}/{fieldname}/options",
        name: "Field Options",
        mimeType: "application/json",
        description: "Available options for a Link or Select field",
      },
      {
        uriTemplate: "schema://modules",
        name: "Module List",
        mimeType: "application/json",
        description: "List of all modules in the system",
      },
      {
        uriTemplate: "schema://doctypes",
        name: "DocType List",
        mimeType: "application/json",
        description: "List of all DocTypes in the system",
      },
    ],
  }));

  // Handle schema resource requests
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      // Handle DocType schema resource
      const schemaMatch = uri.match(/^schema:\/\/([^\/]+)$/);
      if (schemaMatch) {
        const doctype = decodeURIComponent(schemaMatch[1]);
        
        // Special case for modules list
        if (doctype === "modules") {
          const modules = await getAllModules();
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(modules, null, 2),
              },
            ],
          };
        }
        
        // Special case for doctypes list
        if (doctype === "doctypes") {
          const doctypes = await getAllDocTypes();
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(doctypes, null, 2),
              },
            ],
          };
        }
        
        // Regular DocType schema
        const schema = await getDocTypeSchema(doctype);
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      }

      // Handle field options resource
      const optionsMatch = uri.match(/^schema:\/\/([^\/]+)\/([^\/]+)\/options$/);
      if (optionsMatch) {
        const doctype = decodeURIComponent(optionsMatch[1]);
        const fieldname = decodeURIComponent(optionsMatch[2]);
        const options = await getFieldOptions(doctype, fieldname);

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(options, null, 2),
            },
          ],
        };
      }

      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown resource URI: ${uri}`
      );
    } catch (error) {
      console.error(`Error handling resource request for ${uri}:`, error);
      
      if (error instanceof McpError) {
        throw error;
      }
      
      if (error instanceof FrappeApiError) {
        throw new McpError(
          ErrorCode.InternalError,
          error.message
        );
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `Error processing resource request: ${(error as Error).message}`
      );
    }
  });
}