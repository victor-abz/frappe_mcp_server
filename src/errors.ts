import { AxiosError } from "axios";

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

    // Check for connection errors first (no response)
    if (!error.response) {
      // Connection errors
      if (error.code === 'ECONNREFUSED') {
        message = `Connection failed: Could not connect to Frappe server at ${error.config?.baseURL || 'unknown URL'}.`;
        details = {
          error: "Connection refused",
          code: error.code,
          address: (error as any).address,
          port: (error as any).port
        };
        
        // Check if it might be an authentication issue based on the URL or headers
        const authHeader = error.config?.headers?.['Authorization'] as string;
        if (endpoint.includes("/api/method/login") ||
            endpoint.includes("/api/method/frappe.auth") ||
            endpoint.includes("api/method/token") ||
            (authHeader && (authHeader.includes("undefined") || authHeader.includes("null")))) {
          message = `Authentication failed: Could not connect to authentication endpoint. Check your API key and secret.`;
          details = {
            error: "Invalid credentials or connection error",
            originalError: error.message,
            code: error.code
          };
        }
      } else {
        message = `Network error during ${operation}: ${error.message}`;
        details = {
          error: "Network error",
          code: error.code,
          originalError: error.message
        };
      }
    }
    // Extract more detailed error information from Frappe's response
    else if (error.response) {
      const data = error.response.data as any;

      // Check for authentication errors
      if (error.response.status === 401 || error.response.status === 403) {
        // Check for API key/secret issues
        if (data?.message && data.message.includes("Invalid API Key")) {
          message = `Authentication failed: Invalid API key or secret.`;
          details = { error: "Invalid credentials" };
        } else if (error.message.includes("401") || error.message.includes("403")) {
          // If the error message contains 401 or 403 but no specific message from the server,
          // it's likely an authentication issue
          message = `Authentication failed: Invalid API key or secret.`;
          details = { error: "Invalid credentials", originalError: error.message };
        } else {
          message = `Authentication failed: ${error.message}`;
          details = { error: error.message };
        }
      } else if (data.exception) {
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

/**
 * Helper function to handle API errors
 */
export function handleApiError(error: any, operation: string): never {
  if (error.isAxiosError) {
    throw FrappeApiError.fromAxiosError(error, operation);
  } else {
    throw new FrappeApiError(`Error during ${operation}: ${(error as Error).message}`);
  }
}