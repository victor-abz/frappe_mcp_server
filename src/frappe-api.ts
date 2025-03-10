import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { formatFilters } from "./frappe-helpers.js";

/**
 * Error class for Frappe API errors
 */
export class FrappeApiError extends Error {
  statusCode?: number;
  endpoint?: string;
  details?: any;

  constructor(message: string, statusCode?: number, endpoint?: string, details?: any) {
    super(message);
    this.name = "FrappeApiError";
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.details = details;
  }

  static fromAxiosError(error: AxiosError, operation: string): FrappeApiError {
    const statusCode = error.response?.status;
    const endpoint = error.config?.url || "unknown";
    let message = `Frappe API error during ${operation}: ${error.message}`;
    let details = null;

    // Extract more detailed error information from Frappe's response
    if (error.response?.data) {
      const data = error.response.data as any;
      if (data.exception) {
        message = `Frappe exception during ${operation}: ${data.exception}`;
        details = data;
      } else if (data._server_messages) {
        try {
          // Server messages are often JSON strings inside a string
          const serverMessages = JSON.parse(data._server_messages);
          const parsedMessages = Array.isArray(serverMessages)
            ? serverMessages.map((msg: string) => {
                try {
                  return JSON.parse(msg);
                } catch {
                  return msg;
                }
              })
            : [serverMessages];
          
          message = `Frappe server message during ${operation}: ${parsedMessages.map((m: any) => m.message || m).join("; ")}`;
          details = { serverMessages: parsedMessages };
        } catch (e) {
          message = `Frappe server message during ${operation}: ${data._server_messages}`;
          details = { serverMessages: data._server_messages };
        }
      } else if (data.message) {
        message = `Frappe API error during ${operation}: ${data.message}`;
        details = data;
      }
    }

    return new FrappeApiError(message, statusCode, endpoint, details);
  }
}

// Configure axios instance
const apiKey = process.env.FRAPPE_API_KEY;
const apiSecret = process.env.FRAPPE_API_SECRET;
const api: AxiosInstance = axios.create({
  baseURL: process.env.FRAPPE_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `token ${apiKey}:${apiSecret}` // Directly set authorization header
  },
  // Add timeout to prevent hanging requests
  timeout: 30000, // 30 seconds
});

// Add request interceptor for logging
api.interceptors.request.use((config) => {
  console.error(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Add response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    console.error(`[API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      console.error(`[API Error] ${error.response.status} ${error.config?.url}: ${error.message}`);
    } else if (error.request) {
      console.error(`[API Error] No response received: ${error.message}`);
    } else {
      console.error(`[API Error] Request setup failed: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

// Set authentication - No longer needed as auth is set directly
// export function setAuth(apiKey: string, apiSecret: string): void {
//   api.defaults.headers.common["Authorization"] = `token ${apiKey}:${apiSecret}`;
//   console.error("Authentication credentials set");
// }

/**
 * Helper function to handle API errors
 */
function handleApiError(error: any, operation: string): never {
  if (axios.isAxiosError(error)) {
    throw FrappeApiError.fromAxiosError(error, operation);
  } else {
    throw new FrappeApiError(`Error during ${operation}: ${(error as Error).message}`);
  }
}

// Document operations
export async function getDocument(
  doctype: string,
  name: string,
  fields?: string[]
): Promise<any> {
  try {
    if (!doctype) throw new Error("DocType is required");
    if (!name) throw new Error("Document name is required");

    const fieldsParam = fields ? `?fields=${JSON.stringify(fields)}` : "";
    const response = await api.get(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}${fieldsParam}`
    );
    
    if (!response.data || !response.data.data) {
      throw new Error(`Invalid response format for document ${doctype}/${name}`);
    }
    
    return response.data.data;
  } catch (error) {
    return handleApiError(error, `get_document(${doctype}, ${name})`);
  }
}

export async function createDocument(
  doctype: string,
  values: Record<string, any>
): Promise<any> {
  try {
    if (!doctype) throw new Error("DocType is required");
    if (!values || Object.keys(values).length === 0) {
      throw new Error("Document values are required");
    }

    const response = await api.post(`/api/resource/${encodeURIComponent(doctype)}`, values);
    
    if (!response.data || !response.data.data) {
      throw new Error(`Invalid response format for creating ${doctype}`);
    }
    
    return response.data.data;
  } catch (error) {
    return handleApiError(error, `create_document(${doctype})`);
  }
}

export async function updateDocument(
  doctype: string,
  name: string,
  values: Record<string, any>
): Promise<any> {
  try {
    if (!doctype) throw new Error("DocType is required");
    if (!name) throw new Error("Document name is required");
    if (!values || Object.keys(values).length === 0) {
      throw new Error("Update values are required");
    }

    const response = await api.put(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      values
    );
    
    if (!response.data || !response.data.data) {
      throw new Error(`Invalid response format for updating ${doctype}/${name}`);
    }
    
    return response.data.data;
  } catch (error) {
    return handleApiError(error, `update_document(${doctype}, ${name})`);
  }
}

export async function deleteDocument(
  doctype: string,
  name: string
): Promise<any> {
  try {
    if (!doctype) throw new Error("DocType is required");
    if (!name) throw new Error("Document name is required");

    const response = await api.delete(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
    );
    
    return response.data.data;
  } catch (error) {
    return handleApiError(error, `delete_document(${doctype}, ${name})`);
  }
}

export async function listDocuments(
  doctype: string,
  filters?: Record<string, any>,
  fields?: string[],
  limit?: number,
  order_by?: string,
  limit_start?: number
): Promise<any[]> {
  try {
    if (!doctype) throw new Error("DocType is required");

    const params: Record<string, string> = {};
    
    if (filters) params.filters = JSON.stringify(filters);
    if (fields) params.fields = JSON.stringify(fields);
    if (limit !== undefined) params.limit = limit.toString();
    if (order_by) params.order_by = order_by;
    if (limit_start !== undefined) params.limit_start = limit_start.toString();

    const config: AxiosRequestConfig = {
      params: params
    };

    console.error(`[DEBUG] Requesting documents for ${doctype} with params:`, params);
    
    const response = await api.get(`/api/resource/${encodeURIComponent(doctype)}`, config);
    
    if (!response.data || !response.data.data) {
      throw new Error(`Invalid response format for listing ${doctype}`);
    }
    
    console.error(`[DEBUG] Retrieved ${response.data.data.length} ${doctype} documents`);
    
    return response.data.data;
  } catch (error) {
    return handleApiError(error, `list_documents(${doctype})`);
  }
}

/**
 * Execute a Frappe method call
 * @param method The method name to call
 * @param params The parameters to pass to the method
 * @returns The method response
 */
export async function callMethod(
  method: string,
  params?: Record<string, any>
): Promise<any> {
  try {
    if (!method) throw new Error("Method name is required");

    const response = await api.post(`/api/method/${method}`, params || {});
    
    if (!response.data) {
      throw new Error(`Invalid response format for method ${method}`);
    }
    
    return response.data.message;
  } catch (error) {
    return handleApiError(error, `call_method(${method})`);
  }
}

// Schema operations
/**
 * Get the schema for a DocType
 * @param doctype The DocType name
 * @returns The DocType schema
 */
export async function getDocTypeSchema(doctype: string): Promise<any> {
  try {
    if (!doctype) throw new Error("DocType name is required");

    // Primary approach: Use the standard API endpoint
    console.error(`Using standard API endpoint for ${doctype}`);
    let response;
    try {
      response = await api.get(
        `/api/v2/doctype/${encodeURIComponent(doctype)}/meta`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        }
      );
      console.error(`Got response from standard API endpoint for ${doctype}`);
      console.error(`Raw response data:`, JSON.stringify(response?.data, null, 2)); // Log raw response data
    } catch (error) {
      console.error(`Error using standard API endpoint for ${doctype}:`, error);
      // Fallback to document API
    }

    // Directly use response data from standard API endpoint (/api/v2/doctype/{doctype}/meta)
    const docTypeData = response?.data?.data; // Access schema data under response.data.data
    console.error(`Using /api/v2/doctype/{doctype}/meta format`);

    if (docTypeData) {
      // If we got schema data from standard API, process and return it
      const doctypeInfo = docTypeData.doctype || {};
      return {
        name: doctype,
        label: doctypeInfo.name || doctype,
        description: doctypeInfo.description,
        module: doctypeInfo.module,
        issingle: doctypeInfo.issingle === 1,
        istable: doctypeInfo.istable === 1,
        custom: doctypeInfo.custom === 1,
        fields: (docTypeData.fields || []).map((field: any) => ({
          fieldname: field.fieldname,
          label: field.label,
          fieldtype: field.fieldtype,
          required: field.reqd === 1,
          description: field.description,
          default: field.default,
          options: field.options,
          // Include validation information
          min_length: field.min_length,
          max_length: field.max_length,
          min_value: field.min_value,
          max_value: field.max_value,
          // Include linked DocType information if applicable
          linked_doctype: field.fieldtype === "Link" ? field.options : null,
          // Include child table information if applicable
          child_doctype: field.fieldtype === "Table" ? field.options : null,
          // Include additional field metadata
          in_list_view: field.in_list_view === 1,
          in_standard_filter: field.in_standard_filter === 1,
          in_global_search: field.in_global_search === 1,
          bold: field.bold === 1,
          hidden: field.hidden === 1,
          read_only: field.read_only === 1,
          allow_on_submit: field.allow_on_submit === 1,
          set_only_once: field.set_only_once === 1,
          allow_bulk_edit: field.allow_bulk_edit === 1,
          translatable: field.translatable === 1,
        })),
        // Include permissions information
        permissions: docTypeData.permissions || [],
        // Include naming information
        autoname: doctypeInfo.autoname,
        name_case: doctypeInfo.name_case,
        // Include workflow information if available
        workflow: docTypeData.workflow || null,
        // Include additional metadata
        is_submittable: doctypeInfo.is_submittable === 1,
        quick_entry: doctypeInfo.quick_entry === 1,
        track_changes: doctypeInfo.track_changes === 1,
        track_views: doctypeInfo.track_views === 1,
        has_web_view: doctypeInfo.has_web_view === 1,
        allow_rename: doctypeInfo.allow_rename === 1,
        allow_copy: doctypeInfo.allow_copy === 1,
        allow_import: doctypeInfo.allow_import === 1,
        allow_events_in_timeline: doctypeInfo.allow_events_in_timeline === 1,
        allow_auto_repeat: doctypeInfo.allow_auto_repeat === 1,
        document_type: doctypeInfo.document_type,
        icon: doctypeInfo.icon,
        max_attachments: doctypeInfo.max_attachments,
      };
    }


    // Fallback to Document API if standard API failed or didn't return schema data
    console.error(`Falling back to document API for ${doctype}`);
    try {
      console.error(`Using document API to get schema for ${doctype}`);

      // 1. Get the DocType document
      console.error(`Fetching DocType document for ${doctype}`);
      const doctypeDoc = await getDocument("DocType", doctype);
      console.error(`DocType document response:`, JSON.stringify(doctypeDoc).substring(0, 200) + "...");
      console.error(`Full DocType document response:`, doctypeDoc); // Log full response

      if (!doctypeDoc) {
        throw new Error(`DocType ${doctype} not found`);
      }
        
      console.error(`DocTypeDoc.fields before schema construction:`, doctypeDoc.fields); // Log fields
      console.error(`DocTypeDoc.permissions before schema construction:`, doctypeDoc.permissions); // Log permissions
        
        return {
          name: doctype,
          label: doctypeDoc.name || doctype,
          description: doctypeDoc.description,
          module: doctypeDoc.module,
          issingle: doctypeDoc.issingle === 1,
          istable: doctypeDoc.istable === 1,
          custom: doctypeDoc.custom === 1,
          fields: doctypeDoc.fields || [], // Use fields from doctypeDoc if available, otherwise default to empty array
          permissions: doctypeDoc.permissions || [], // Use permissions from doctypeDoc if available, otherwise default to empty array
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


    } catch (error) {
      console.error(`Error using document API for ${doctype}:`, error);
      // If document API also fails, then we cannot retrieve the schema
    }


    throw new Error(`Could not retrieve schema for DocType ${doctype} using any available method`);
  } catch (error) {
    return handleApiError(error, `get_doctype_schema(${doctype})`);
  }
}

export async function getFieldOptions(
  doctype: string,
  fieldname: string,
  filters?: Record<string, any>
): Promise<Array<{ value: string; label: string }>> {
  try {
    if (!doctype) throw new Error("DocType name is required");
    if (!fieldname) throw new Error("Field name is required");

    // First get the field metadata to determine the type and linked DocType
    const schema = await getDocTypeSchema(doctype);
    
    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      throw new Error(`Invalid schema returned for DocType ${doctype}`);
    }
    
    const field = schema.fields.find((f: any) => f.fieldname === fieldname);

    if (!field) {
      throw new Error(`Field ${fieldname} not found in DocType ${doctype}`);
    }

    if (field.fieldtype === "Link") {
      // For Link fields, get the list of documents from the linked DocType
      const linkedDocType = field.options;
      if (!linkedDocType) {
        throw new Error(`Link field ${fieldname} has no options (linked DocType) specified`);
      }
      
      console.error(`Getting options for Link field ${fieldname} from DocType ${linkedDocType}`);
      
      try {
        // Try to get the title field for the linked DocType
        const linkedSchema = await getDocTypeSchema(linkedDocType);
        const titleField = linkedSchema.fields.find((f: any) => f.fieldname === "title" || f.bold === 1);
        const displayFields = titleField ? ["name", titleField.fieldname] : ["name"];
        
        const response = await api.get(`/api/resource/${encodeURIComponent(linkedDocType)}`, {
          params: {
            filters: filters ? JSON.stringify(filters) : undefined,
            fields: JSON.stringify(displayFields),
            limit: 50 // Add a reasonable limit to avoid performance issues
          },
        });
        
        if (!response.data || !response.data.data) {
          throw new Error(`Invalid response for DocType ${linkedDocType}`);
        }

        return response.data.data.map((item: any) => {
          const label = titleField && item[titleField.fieldname]
            ? `${item.name} - ${item[titleField.fieldname]}`
            : item.name;
            
          return {
            value: item.name,
            label: label,
          };
        });
      } catch (error) {
        console.error(`Error fetching options for Link field ${fieldname}:`, error);
        // Try a simpler approach as fallback
        const response = await api.get(`/api/resource/${encodeURIComponent(linkedDocType)}`, {
          params: {
            fields: JSON.stringify(["name"]),
            limit: 50
          },
        });
        
        if (!response.data || !response.data.data) {
          throw new Error(`Invalid response for DocType ${linkedDocType}`);
        }

        return response.data.data.map((item: any) => ({
          value: item.name,
          label: item.name,
        }));
      }
    } else if (field.fieldtype === "Select") {
      // For Select fields, parse the options string
      console.error(`Getting options for Select field ${fieldname}: ${field.options}`);
      
      if (!field.options) {
        return [];
      }
      
      return field.options.split("\n")
        .filter((option: string) => option.trim() !== '')
        .map((option: string) => ({
          value: option.trim(),
          label: option.trim(),
        }));
    } else if (field.fieldtype === "Table") {
      // For Table fields, return an empty array with a message
      console.error(`Field ${fieldname} is a Table field, no options available`);
      return [];
    } else {
      console.error(`Field ${fieldname} is type ${field.fieldtype}, not Link or Select`);
      return [];
    }
  } catch (error) {
    console.error(`Error in getFieldOptions for ${doctype}.${fieldname}:`, error);
    if (axios.isAxiosError(error)) {
      throw FrappeApiError.fromAxiosError(error, `get_field_options(${doctype}, ${fieldname})`);
    } else {
      throw new FrappeApiError(`Error getting field options for ${doctype}.${fieldname}: ${(error as Error).message}`);
    }
  }
}

/**
 * Get a list of all DocTypes in the system
 * @returns Array of DocType names
 */
export async function getAllDocTypes(): Promise<string[]> {
  try {
    const response = await api.get('/api/resource/DocType', {
      params: {
        fields: JSON.stringify(["name"]),
        limit: 1000
      }
    });
    
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response format for DocType list');
    }
    
    return response.data.data.map((item: any) => item.name);
  } catch (error) {
    return handleApiError(error, 'get_all_doctypes');
  }
}

/**
 * Get a list of all modules in the system
 * @returns Array of module names
 */
export async function getAllModules(): Promise<string[]> {
  try {
    const response = await api.get('/api/resource/Module Def', {
      params: {
        fields: JSON.stringify(["name", "module_name"]),
        limit: 100
      }
    });
    
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response format for Module list');
    }
    
    return response.data.data.map((item: any) => item.name || item.module_name);
  } catch (error) {
    return handleApiError(error, 'get_all_modules');
  }
}