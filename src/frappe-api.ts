import axios, { AxiosInstance } from "axios";

// Configure axios instance
const api: AxiosInstance = axios.create({
  baseURL: process.env.FRAPPE_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Set authentication
export function setAuth(apiKey: string, apiSecret: string): void {
  api.defaults.headers.common["Authorization"] = `token ${apiKey}:${apiSecret}`;
}

// Document operations
export async function getDocument(
  doctype: string,
  name: string,
  fields?: string[]
): Promise<any> {
  const fieldsParam = fields ? `?fields=${JSON.stringify(fields)}` : "";
  const response = await api.get(
    `/api/resource/${doctype}/${name}${fieldsParam}`
  );
  return response.data.data;
}

export async function createDocument(
  doctype: string,
  values: Record<string, any>
): Promise<any> {
  const response = await api.post(`/api/resource/${doctype}`, values);
  return response.data.data;
}

export async function updateDocument(
  doctype: string,
  name: string,
  values: Record<string, any>
): Promise<any> {
  const response = await api.put(`/api/resource/${doctype}/${name}`, values);
  return response.data.data;
}

export async function deleteDocument(
  doctype: string,
  name: string
): Promise<any> {
  const response = await api.delete(`/api/resource/${doctype}/${name}`);
  return response.data.data;
}

export async function listDocuments(
  doctype: string,
  filters?: Record<string, any>,
  fields?: string[],
  limit?: number,
  order_by?: string,
  limit_start?: number
): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters) params.append("filters", JSON.stringify(filters));
  if (fields) params.append("fields", JSON.stringify(fields));
  if (limit) params.append("limit", limit.toString());
  if (order_by) params.append("order_by", order_by);
  if (limit_start) params.append("limit_start", limit_start.toString());

  const url = `/api/resource/${doctype}?${params.toString()}`;
  console.error(`[DEBUG] Requesting URL: ${url}`);
  console.error(`[DEBUG] Parameters: limit_start=${limit_start}, limit=${limit}`);
  
  const response = await api.get(url);
  console.error(`[DEBUG] Response data length: ${response.data.data.length}`);
  console.error(`[DEBUG] First item: ${JSON.stringify(response.data.data[0])}`);
  
  return response.data.data;
}

// Schema operations
export async function getDocTypeSchema(doctype: string): Promise<any> {
  const response = await api.get(
    `/api/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent(
      doctype
    )}`
  );

  // Add debug logging for the raw response
  console.error(`Raw response for ${doctype}:`, JSON.stringify(response.data, null, 2));
  
  // Handle different response formats
  let docTypeData;
  
  if (response.data.message) {
    // Standard format from frappe.desk.form.load.getdoctype
    docTypeData = response.data.message;
    console.error(`Using message format for ${doctype}`);
  } else if (response.data.docs && response.data.docs.length > 0) {
    // Alternative format with docs array
    const docTypeDoc = response.data.docs.find((doc: any) => doc.doctype === "DocType" && doc.name === doctype);
    
    if (!docTypeDoc) {
      throw new Error(`DocType ${doctype} not found in response docs`);
    }
    
    // Extract fields from the docs array
    const fields = response.data.docs.filter((doc: any) =>
      doc.doctype === "DocField" &&
      doc.parent === doctype
    );
    
    // Extract permissions from the docs array
    const permissions = response.data.docs.filter((doc: any) =>
      doc.doctype === "DocPerm" &&
      doc.parent === doctype
    );
    
    // Construct a compatible docTypeData object
    docTypeData = {
      doctype: docTypeDoc,
      fields: fields,
      permissions: permissions
    };
    
    console.error(`Using docs array format for ${doctype}, found ${fields.length} fields`);
  } else {
    throw new Error(`Unrecognized schema response format for DocType ${doctype}: ${JSON.stringify(response.data)}`);
  }
  
  // Add debug logging for the processed data
  console.error(`Processed DocType data for ${doctype}:`, JSON.stringify(docTypeData, null, 2));
  
  if (!docTypeData || (!docTypeData.doctype && !docTypeData.fields)) {
    throw new Error(`Invalid schema response for DocType ${doctype}: ${JSON.stringify(response.data)}`);
  }

  // Extract doctype info
  const doctypeInfo = docTypeData.doctype || {};
  
  return {
    name: doctype,
    label: doctypeInfo.name || doctype,
    description: doctypeInfo.description,
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
    })),
    // Include permissions information
    permissions: docTypeData.permissions || [],
    // Include naming information
    autoname: doctypeInfo.autoname,
    // Include workflow information if available
    workflow: docTypeData.workflow || null,
  };
}

export async function getFieldOptions(
  doctype: string,
  fieldname: string,
  filters?: Record<string, any>
): Promise<Array<{ value: string; label: string }>> {
  try {
    // First get the field metadata to determine the type and linked DocType
    const schema = await getDocTypeSchema(doctype);
    
    if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
      console.error(`Invalid schema returned for DocType ${doctype}`);
      return [];
    }
    
    const field = schema.fields.find((f: any) => f.fieldname === fieldname);
    console.error(`Field data for ${fieldname}:`, JSON.stringify(field, null, 2));

    if (!field) {
      console.error(`Field ${fieldname} not found in DocType ${doctype}`);
      return [];
    }

    if (field.fieldtype === "Link") {
      // For Link fields, get the list of documents from the linked DocType
      const linkedDocType = field.options;
      if (!linkedDocType) {
        console.error(`Link field ${fieldname} has no options (linked DocType) specified`);
        return [];
      }
      
      console.error(`Getting options for Link field ${fieldname} from DocType ${linkedDocType}`);
      
      try {
        const response = await api.get(`/api/resource/${linkedDocType}`, {
          params: {
            filters: filters ? JSON.stringify(filters) : undefined,
            fields: JSON.stringify(["name", "title_field"]),
            limit: 50 // Add a reasonable limit to avoid performance issues
          },
        });
        
        console.error(`Response for ${linkedDocType}:`, JSON.stringify(response.data, null, 2));
        
        if (!response.data || !response.data.data) {
          console.error(`Invalid response for DocType ${linkedDocType}: ${JSON.stringify(response.data)}`);
          return [];
        }

        return response.data.data.map((item: any) => ({
          value: item.name,
          label: item.title_field || item.name,
        }));
      } catch (error) {
        console.error(`Error fetching options for Link field ${fieldname}:`, error);
        // Return empty array instead of failing completely
        return [];
      }
    } else if (field.fieldtype === "Select") {
      // For Select fields, parse the options string
      console.error(`Getting options for Select field ${fieldname}: ${field.options}`);
      
      if (!field.options) {
        return [];
      }
      
      return field.options.split("\n").map((option: string) => ({
        value: option.trim(),
        label: option.trim(),
      }));
    } else {
      console.error(`Field ${fieldname} is type ${field.fieldtype}, not Link or Select`);
      // Return empty array instead of throwing error
      return [];
    }
  } catch (error) {
    console.error(`Error in getFieldOptions for ${doctype}.${fieldname}:`, error);
    // Return empty array as fallback
    return [];
  }
}