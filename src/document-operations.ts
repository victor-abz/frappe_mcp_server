import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { callMethod } from "./frappe-api.js";
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  createDocumentWithAuth,
  getDocumentWithAuth,
  updateDocumentWithAuth,
  deleteDocumentWithAuth,
  listDocumentsWithAuth,
  FrappeApiError
} from "./frappe-api.js";
import { getRequiredFields, formatFilters } from "./frappe-helpers.js";
import { FRAPPE_INSTRUCTIONS } from "./frappe-instructions.js";

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

/**
 * Validate document values against required fields
 */
async function validateDocumentValues(doctype: string, values: Record<string, any>): Promise<string[]> {
  try {
    const requiredFields = await getRequiredFields(doctype);
    const missingFields = requiredFields
      .filter(field => !values.hasOwnProperty(field.fieldname))
      .map(field => field.fieldname);

    return missingFields;
  } catch (error) {
    console.error(`Error validating document values for ${doctype}:`, error);
    return []; // Return empty array on error to avoid blocking the operation
  }
}

// Define document tools
export const DOCUMENT_TOOLS = [
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
];

// Export a handler function for document tool calls
export async function handleDocumentToolCall(request: any): Promise<any> {
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
    console.error("Handling document tool:", name, "with args:", args);

    // Handle document operations
    if (name === "create_document") {
      const doctype = args.doctype as string;
      const values = args.values as Record<string, any>;

      if (!doctype || !values) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameters: doctype and values",
            },
          ],
          isError: true,
        };
      }

      // Validate required fields
      const missingFields = await validateDocumentValues(doctype, values);
      if (missingFields.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: `Missing required fields: ${missingFields.join(', ')}`,
            },
            {
              type: "text",
              text: "\nTip: Use get_required_fields tool to see all required fields for this DocType.",
            },
          ],
          isError: true,
        };
      }

      try {
        console.error(`Calling createDocument for ${doctype} with values:`, JSON.stringify(values, null, 2));

        let result;
        let authMethod = "token";

        try {
          // Try token authentication first
          result = await createDocument(doctype, values);
          console.error(`Result from createDocument (token auth):`, JSON.stringify(result, null, 2));
        } catch (tokenError) {
          console.error(`Error with token authentication, trying password auth:`, tokenError);

          // Fall back to password authentication
          try {
            result = await createDocumentWithAuth(doctype, values);
            console.error(`Result from createDocumentWithAuth:`, JSON.stringify(result, null, 2));
            authMethod = "password";
          } catch (passwordError) {
            console.error(`Error with password authentication:`, passwordError);
            throw passwordError; // Re-throw to be caught by outer catch block
          }
        }

        // Try to verify if the document was actually created
        try {
          console.error(`Verifying document creation by listing documents`);
          const documents = await listDocuments(
            doctype,
            { description: ["like", `%${values.description?.substring(0, 20) || ""}%`] },
            undefined,
            5
          );
          console.error(`Verification results:`, JSON.stringify(documents, null, 2));

          if (documents.length === 0) {
            console.error(`Warning: Document may not have been created despite successful API response`);
          }
        } catch (verifyError) {
          console.error(`Error during verification:`, verifyError);
        }

        return {
          content: [
            {
              type: "text",
              text: `Document created successfully using ${authMethod} authentication:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        console.error(`Error in create_document handler:`, error);
        return formatErrorResponse(error, `create_document(${doctype})`);
      }
    } else if (name === "get_document") {
      const doctype = args.doctype as string;
      const docName = args.name as string;
      const fields = args.fields as string[] | undefined;

      if (!doctype || !docName) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameters: doctype and name",
            },
          ],
          isError: true,
        };
      }

      try {
        let document;
        let authMethod = "token";

        try {
          // Try token authentication first
          document = await getDocument(doctype, docName, fields);
          console.error(`Retrieved document using token auth:`, JSON.stringify(document, null, 2));
        } catch (tokenError) {
          console.error(`Error with token authentication, trying password auth:`, tokenError);

          // Fall back to password authentication
          try {
            document = await getDocumentWithAuth(doctype, docName, fields);
            console.error(`Retrieved document using password auth:`, JSON.stringify(document, null, 2));
            authMethod = "password";
          } catch (passwordError) {
            console.error(`Error with password authentication:`, passwordError);
            throw passwordError; // Re-throw to be caught by outer catch block
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Document retrieved using ${authMethod} authentication:\n\n${JSON.stringify(document, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `get_document(${doctype}, ${docName})`);
      }
    } else if (name === "update_document") {
      const doctype = args.doctype as string;
      const docName = args.name as string;
      const values = args.values as Record<string, any>;

      if (!doctype || !docName || !values) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameters: doctype, name, and values",
            },
          ],
          isError: true,
        };
      }

      try {
        let result;
        let authMethod = "token";

        try {
          // Try token authentication first
          result = await updateDocument(doctype, docName, values);
          console.error(`Result from updateDocument (token auth):`, JSON.stringify(result, null, 2));
        } catch (tokenError) {
          console.error(`Error with token authentication, trying password auth:`, tokenError);

          // Fall back to password authentication
          try {
            result = await updateDocumentWithAuth(doctype, docName, values);
            console.error(`Result from updateDocumentWithAuth:`, JSON.stringify(result, null, 2));
            authMethod = "password";
          } catch (passwordError) {
            console.error(`Error with password authentication:`, passwordError);
            throw passwordError; // Re-throw to be caught by outer catch block
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Document updated successfully using ${authMethod} authentication:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `update_document(${doctype}, ${docName})`);
      }
    } else if (name === "delete_document") {
      const doctype = args.doctype as string;
      const docName = args.name as string;

      if (!doctype || !docName) {
        return {
          content: [
            {
              type: "text",
              text: "Missing required parameters: doctype and name",
            },
          ],
          isError: true,
        };
      }

      try {
        let authMethod = "token";

        try {
          // Try token authentication first
          await deleteDocument(doctype, docName);
          console.error(`Document deleted using token auth`);
        } catch (tokenError) {
          console.error(`Error with token authentication, trying password auth:`, tokenError);

          // Fall back to password authentication
          try {
            await deleteDocumentWithAuth(doctype, docName);
            console.error(`Document deleted using password auth`);
            authMethod = "password";
          } catch (passwordError) {
            console.error(`Error with password authentication:`, passwordError);
            throw passwordError; // Re-throw to be caught by outer catch block
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Document ${doctype}/${docName} deleted successfully using ${authMethod} authentication`
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `delete_document(${doctype}, ${docName})`);
      }
    } else if (name === "list_documents") {
      const doctype = args.doctype as string;
      const filters = args.filters as Record<string, any> | undefined;
      const fields = args.fields as string[] | undefined;
      const limit = args.limit as number | undefined;
      const order_by = args.order_by as string | undefined;
      const limit_start = args.limit_start as number | undefined;

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
        // Format filters if provided
        const formattedFilters = filters ? formatFilters(filters) : undefined;

        let documents;
        let authMethod = "token";

        try {
          // Try token authentication first
          documents = await listDocuments(
            doctype,
            formattedFilters,
            fields,
            limit,
            order_by,
            limit_start
          );
          console.error(`Retrieved ${documents.length} documents using token auth`);
        } catch (tokenError) {
          console.error(`Error with token authentication, trying password auth:`, tokenError);

          // Fall back to password authentication
          try {
            documents = await listDocumentsWithAuth(
              doctype,
              formattedFilters,
              fields,
              limit,
              order_by,
              limit_start
            );
            console.error(`Retrieved ${documents.length} documents using password auth`);
            authMethod = "password";
          } catch (passwordError) {
            console.error(`Error with password authentication:`, passwordError);
            throw passwordError; // Re-throw to be caught by outer catch block
          }
        }

        // Add pagination info if applicable
        let paginationInfo = "";
        if (limit) {
          const startIndex = limit_start || 0;
          const endIndex = startIndex + documents.length;
          paginationInfo = `\n\nShowing items ${startIndex + 1}-${endIndex}`;

          if (documents.length === limit) {
            paginationInfo += ` (more items may be available, use limit_start=${endIndex} to see next page)`;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Documents retrieved using ${authMethod} authentication:\n\n${JSON.stringify(documents, null, 2)}${paginationInfo}`,
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(error, `list_documents(${doctype})`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Document operations module doesn't handle tool: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    return formatErrorResponse(error, `document_operations.${name}`);
  }
}

export function setupDocumentTools(server: Server): void {
  // We no longer register tools here
  // Tools are now registered in the central handler in index.ts

  // This function is kept as a no-op to prevent import errors
  console.error("Document tools are now registered in the central handler in index.ts");
}

/**
 * Handle call_method tool call
 */
export async function handleCallMethodToolCall(request: any): Promise<any> {
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
    console.error(`Handling call_method tool with args:`, args);
    const method = args.method as string;
    const params = args.params as Record<string, any> | undefined;

    if (!method) {
      return {
        content: [
          {
            type: "text",
            text: "Missing required parameter: method",
          },
        ],
        isError: true,
      };
    }

    const result = await callMethod(method, params);
    return {
      content: [
        {
          type: "text",
          text: `Method ${method} called successfully:\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return formatErrorResponse(error, `call_method(${name})`);
  }
}