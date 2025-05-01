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
            (authHeader && (authHeader.includes("undefined") || authHeader.includes("null") || authHeader === ':'))) {
          
          // Check if API key/secret are missing
          const apiKey = process.env.FRAPPE_API_KEY;
          const apiSecret = process.env.FRAPPE_API_SECRET;
          
          if (!apiKey && !apiSecret) {
            message = `Authentication failed: Both API key and API secret are missing. API key/secret is the only supported authentication method.`;
          } else if (!apiKey) {
            message = `Authentication failed: API key is missing. API key/secret is the only supported authentication method.`;
          } else if (!apiSecret) {
            message = `Authentication failed: API secret is missing. API key/secret is the only supported authentication method.`;
          } else {
            message = `Authentication failed: Could not connect to authentication endpoint. Check your API key and secret.`;
          }
          
          details = {
            error: "Invalid credentials or connection error",
            originalError: error.message,
            code: error.code,
            authMethod: "API key/secret (token)",
            apiKeyAvailable: !!process.env.FRAPPE_API_KEY,
            apiSecretAvailable: !!process.env.FRAPPE_API_SECRET
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
        // Always include the raw response data for debugging
        const rawResponseData = data ? JSON.stringify(data) : 'No response data';
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        
        // Create a clear authentication error message
        message = `Authentication failed: Invalid or missing API key/secret. API key/secret is the only supported authentication method.`;
        
        // Check for specific error patterns
        if (data?.exc_type && data.exc_type.includes('AuthenticationError')) {
          message = `Authentication failed: Frappe AuthenticationError. API key/secret is invalid or expired.`;
        } else if (data?.message && data.message.includes("Invalid API Key")) {
          message = `Authentication failed: Invalid API key. API key/secret is the only supported authentication method.`;
        } else if (data?._server_messages && data._server_messages.includes("Authentication")) {
          try {
            const serverMsgs = JSON.parse(data._server_messages);
            message = `Authentication failed: ${serverMsgs.join(', ')}. API key/secret is the only supported authentication method.`;
          } catch (e) {
            // Use the raw message if parsing fails
            message = `Authentication failed: ${data._server_messages}. API key/secret is the only supported authentication method.`;
          }
        }
        
        // Include comprehensive details
        details = {
          error: "Authentication Error",
          status: error.response.status,
          statusText: error.response.statusText,
          authMethod: "API key/secret (token)",
          apiKeyAvailable: !!apiKey,
          apiSecretAvailable: !!apiSecret,
          rawResponseData: rawResponseData,
          originalError: error.message,
          url: error.config?.url || 'unknown'
        };
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
  console.error('[DEBUG] Raw error in handleApiError:', error);
  // Check for our custom error with originalErrorInfo
  if (error.originalErrorInfo) {
    console.error(`[DEBUG] Processing error with originalErrorInfo in handleApiError`);
    const info = error.originalErrorInfo;
    
    // Create a detailed error message
    let message = `Error during ${operation}: ${info.message}`;
    
    // Check for authentication issues based on the original error
    if (info.response && (info.response.status === 401 || info.response.status === 403)) {
      message = `Authentication failed during ${operation}: ${info.message}. API key/secret is the only supported authentication method.`;
    } else if (info.message && (
        info.message.includes('auth') ||
        info.message.includes('Authentication') ||
        info.message.includes('credential') ||
        info.message.includes('API key') ||
        info.message.includes('API secret')
    )) {
      message = `Authentication failed during ${operation}: ${info.message}. API key/secret is the only supported authentication method.`;
    }
    
    // Create a FrappeApiError with the detailed information
    const apiError = new FrappeApiError(
      message,
      info.response?.status,
      info.config?.url || 'unknown',
      {
        originalError: info,
        apiKeyAvailable: !!process.env.FRAPPE_API_KEY,
        apiSecretAvailable: !!process.env.FRAPPE_API_SECRET
      }
    );
    
    throw apiError;
  }
  // Standard error handling
  else if (error.isAxiosError) {
    throw FrappeApiError.fromAxiosError(error, operation);
  } else {
    throw new FrappeApiError(`Error during ${operation}: ${(error as Error).message}`);
  }
}