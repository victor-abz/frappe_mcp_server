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
  getAllModules,
  // Add password authentication functions
  getDocumentWithAuth,
  listDocumentsWithAuth
} from "./frappe-api.js";
import { formatFilters } from "./frappe-helpers.js";

// Define schema tools
export const SCHEMA_TOOLS = [
  {
    name: "get_doctype_schema",
    description: "Get the complete schema for a DocType including field definitions, validations, and linked DocTypes. Use this to understand the structure of a DocType before creating or updating documents.",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType name" }
      },
      required: ["doctype"]
    }
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
        }
      },
      required: ["doctype", "fieldname"]
    }
  }
];

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
        let schema;
        let authMethod = "token";

        try {
          // Try token authentication first
          schema = await getDocTypeSchema(doctype);
          console.error(`Retrieved schema for ${doctype} using token auth`);
        } catch (tokenError) {
          console.error(`Error with token authentication, trying password auth:`, tokenError);

          // Fall back to password authentication - we need to implement a custom approach
          // since there's no direct getDocTypeSchemaWithAuth function
          try {
            // For DocType schemas, we can use getDocumentWithAuth to get the DocType document
            console.error(`Attempting to get schema for ${doctype} using password auth`);
            const doctypeDoc = await getDocumentWithAuth("DocType", doctype);

            // Process the document into a schema format similar to getDocTypeSchema
            schema = {
              name: doctype,
              label: doctypeDoc.name || doctype,
              description: doctypeDoc.description,
              module: doctypeDoc.module,
              issingle: doctypeDoc.issingle === 1,
              istable: doctypeDoc.istable === 1,
              custom: doctypeDoc.custom === 1,
              fields: doctypeDoc.fields || [],
              permissions: doctypeDoc.permissions || [],
              autoname: doctypeDoc.autoname,
              name_case: doctypeDoc.name_case,
              workflow: null,
              is_submittable: doctypeDoc.is_submittable === 1,
              quick_entry: doctypeDoc.quick_entry === 1,
              track_changes: doctypeDoc.track_changes === 1,
              track_views: doctypeDoc.track_views === 1,
              has_web_view: doctypeDoc.has_web_view === 1,
              allow_rename: doctypeDoc.allow_rename === 1,
              allow_copy: doctypeDoc.allow_copy === 1,
              allow_import: doctypeDoc.allow_import === 1,
              allow_events_in_timeline: doctypeDoc.allow_events_in_timeline === 1,
              allow_auto_repeat: doctypeDoc.allow_auto_repeat === 1,
              document_type: doctypeDoc.document_type,
              icon: doctypeDoc.icon,
              max_attachments: doctypeDoc.max_attachments,
            };

            console.error(`Successfully created schema for ${doctype} using password auth`);
            authMethod = "password";
          } catch (passwordError) {
            console.error(`Error with password authentication:`, passwordError);
            throw passwordError; // Re-throw to be caught by outer catch block
          }
        }

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
          authMethod: authMethod
        };

        return {
          content: [
            {
              type: "text",
              text: `Schema Summary (retrieved using ${authMethod} authentication):\n${JSON.stringify(summary, null, 2)}\n\nFull Schema:\n${JSON.stringify(schema, null, 2)}`,
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