import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
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
    console.error(`Handling document tool: ${name} with args:`, args);

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
        const result = await createDocument(doctype, values);
        return {
          content: [
            {
              type: "text",
              text: `Document created successfully:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
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
        const document = await getDocument(doctype, docName, fields);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(document, null, 2),
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
        const result = await updateDocument(doctype, docName, values);
        return {
          content: [
            {
              type: "text",
              text: `Document updated successfully:\n\n${JSON.stringify(result, null, 2)}`,
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
        await deleteDocument(doctype, docName);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Document ${doctype}/${docName} deleted successfully`
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
        
        const documents = await listDocuments(
          doctype,
          formattedFilters,
          fields,
          limit,
          order_by,
          limit_start
        );
        
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
              text: `${JSON.stringify(documents, null, 2)}${paginationInfo}`,
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