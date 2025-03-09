import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getDocTypeSchema, getFieldOptions } from "./frappe-api.js";

// Export a handler function for schema tool calls
export function handleSchemaToolCall(request: any): Promise<any> {
  const { name, arguments: args } = request.params;

  if (!args) {
    return Promise.resolve({
      content: [
        {
          type: "text",
          text: "Missing arguments for tool call",
        },
      ],
      isError: true,
    });
  }

  if (name === "get_doctype_schema") {
    try {
      const doctype = args.doctype as string;
      if (!doctype) {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: "Missing required parameter: doctype",
            },
          ],
          isError: true,
        });
      }
      
      return getDocTypeSchema(doctype).then(schema => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      })).catch(error => ({
        content: [
          {
            type: "text",
            text: `Error fetching schema: ${(error as Error).message}`,
          },
        ],
        isError: true,
      }));
    } catch (error) {
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: `Error fetching schema: ${(error as Error).message}`,
          },
        ],
        isError: true,
      });
    }
  } else if (name === "get_field_options") {
    try {
      const doctype = args.doctype as string;
      const fieldname = args.fieldname as string;
      
      if (!doctype || !fieldname) {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: "Missing required parameters: doctype and fieldname are required",
            },
          ],
          isError: true,
        });
      }
      
      const filters = args.filters as Record<string, any> | undefined;
      
      return getFieldOptions(
        doctype,
        fieldname,
        filters
      ).then(options => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(options, null, 2),
          },
        ],
      })).catch(error => ({
        content: [
          {
            type: "text",
            text: `Error fetching field options: ${(error as Error).message}`,
          },
        ],
        isError: true,
      }));
    } catch (error) {
      return Promise.resolve({
        content: [
          {
            type: "text",
            text: `Error fetching field options: ${(error as Error).message}`,
          },
        ],
        isError: true,
      });
    }
  }

  return Promise.resolve({
    content: [
      {
        type: "text",
        text: `Schema operations module doesn't handle tool: ${name}`,
      },
    ],
    isError: true,
  });
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
    ],
  }));

  // Handle schema resource requests
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // Handle DocType schema resource
    const schemaMatch = uri.match(/^schema:\/\/([^\/]+)$/);
    if (schemaMatch) {
      try {
        const doctype = decodeURIComponent(schemaMatch[1]);
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
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error fetching schema: ${(error as Error).message}`
        );
      }
    }

    // Handle field options resource
    const optionsMatch = uri.match(/^schema:\/\/([^\/]+)\/([^\/]+)\/options$/);
    if (optionsMatch) {
      try {
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
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error fetching field options: ${(error as Error).message}`
        );
      }
    }

    throw new McpError(
      ErrorCode.InvalidRequest,
      `Unknown resource URI: ${uri}`
    );
  });
}