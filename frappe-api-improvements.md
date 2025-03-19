# Improving Error Checking in Frappe MCP Server

After analyzing the code in the Frappe MCP server, I've identified several areas where the error checking could be improved to make the system more robust against silent failures. Here are specific recommendations:

## 1. Enhance Document Creation Verification

### In `src/frappe-api.ts`

The `createDocument` function currently attempts to verify document creation but doesn't propagate verification failures. Here's how it could be improved:

```typescript
export async function createDocument(
  doctype: string,
  values: Record<string, any>
): Promise<any> {
  try {
    if (!doctype) throw new Error("DocType is required");
    if (!values || Object.keys(values).length === 0) {
      throw new Error("Document values are required");
    }

    console.error(`Creating document of type ${doctype} with values:`, JSON.stringify(values, null, 2));

    const response = await frappe.db().createDoc(doctype, values);

    console.error(`Create document response:`, JSON.stringify(response, null, 2));

    if (!response) {
      throw new Error(`Invalid response format for creating ${doctype}`);
    }

    // IMPROVED VERIFICATION: Make this a required step, not just a try-catch
    const verificationResult = await verifyDocumentCreation(doctype, values, response);
    if (!verificationResult.success) {
      throw new Error(`Document creation verification failed: ${verificationResult.message}`);
    }

    return response;
  } catch (error) {
    console.error(`Error in createDocument:`, error);
    return handleApiError(error, `create_document(${doctype})`);
  }
}

// New helper function for verification
async function verifyDocumentCreation(
  doctype: string,
  values: Record<string, any>,
  creationResponse: any
): Promise<{ success: boolean; message: string }> {
  try {
    // First check if we have a name in the response
    if (!creationResponse.name) {
      return { success: false, message: "Response does not contain a document name" };
    }

    // Try to fetch the document directly by name
    try {
      const document = await frappe.db().getDoc(doctype, creationResponse.name);
      if (document && document.name === creationResponse.name) {
        return { success: true, message: "Document verified by direct fetch" };
      }
    } catch (error) {
      console.error(`Error fetching document by name during verification:`, error);
      // Continue with alternative verification methods
    }

    // Try to find the document by filtering
    const filters: Record<string, any> = {};
    
    // Use the most unique fields for filtering
    if (values.name) {
      filters['name'] = ['=', values.name];
    } else if (values.title) {
      filters['title'] = ['=', values.title];
    } else if (values.description) {
      // Use a substring of the description to avoid issues with long text
      filters['description'] = ['like', `%${values.description.substring(0, 20)}%`];
    }

    if (Object.keys(filters).length > 0) {
      const documents = await frappe.db().getDocList(doctype, {
        filters: filters as any[],
        limit: 5
      });
      
      if (documents && documents.length > 0) {
        // Check if any of the returned documents match our expected name
        const matchingDoc = documents.find(doc => doc.name === creationResponse.name);
        if (matchingDoc) {
          return { success: true, message: "Document verified by filter search" };
        }
        
        // If we found documents but none match our expected name, that's suspicious
        return { 
          success: false, 
          message: `Found ${documents.length} documents matching filters, but none match the expected name ${creationResponse.name}` 
        };
      }
      
      return { 
        success: false, 
        message: "No documents found matching the creation filters" 
      };
    }
    
    // If we couldn't verify with filters, return a warning
    return { 
      success: false, 
      message: "Could not verify document creation - no suitable filters available" 
    };
  } catch (verifyError) {
    return { 
      success: false, 
      message: `Error during verification: ${(verifyError as Error).message}` 
    };
  }
}
```

Apply similar improvements to `createDocumentWithAuth`.

## 2. Improve Error Handling in Document Tool Call Handler

### In `src/document-operations.ts`

The `handleDocumentToolCall` function should be updated to properly handle verification failures:

```typescript
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
    let verificationSuccess = false;
    let verificationMessage = "";

    try {
      // Try token authentication first
      result = await createDocument(doctype, values);
      console.error(`Result from createDocument (token auth):`, JSON.stringify(result, null, 2));
      
      // IMPROVED: Check for verification result
      if (result._verification && result._verification.success === false) {
        verificationSuccess = false;
        verificationMessage = result._verification.message;
        delete result._verification; // Remove internal property before returning to client
      } else {
        verificationSuccess = true;
      }
    } catch (tokenError) {
      console.error(`Error with token authentication, trying password auth:`, tokenError);

      // Fall back to password authentication
      try {
        result = await createDocumentWithAuth(doctype, values);
        console.error(`Result from createDocumentWithAuth:`, JSON.stringify(result, null, 2));
        authMethod = "password";
        
        // IMPROVED: Check for verification result
        if (result._verification && result._verification.success === false) {
          verificationSuccess = false;
          verificationMessage = result._verification.message;
          delete result._verification; // Remove internal property before returning to client
        } else {
          verificationSuccess = true;
        }
      } catch (passwordError) {
        console.error(`Error with password authentication:`, passwordError);
        throw passwordError; // Re-throw to be caught by outer catch block
      }
    }

    // IMPROVED: Return error if verification failed
    if (!verificationSuccess) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Document creation reported success but verification failed. The document may not have been created.\n\nDetails: ${verificationMessage}`,
          },
        ],
        isError: true,
      };
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
}
```

## 3. Add Retry Logic for Document Creation

Consider adding retry logic with exponential backoff for document creation operations:

```typescript
async function createDocumentWithRetry(
  doctype: string,
  values: Record<string, any>,
  maxRetries = 3
): Promise<any> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.error(`Attempt ${attempt} to create document of type ${doctype}`);
      
      const result = await frappe.db().createDoc(doctype, values);
      
      // Verify document creation
      const verificationResult = await verifyDocumentCreation(doctype, values, result);
      if (verificationResult.success) {
        console.error(`Document creation verified on attempt ${attempt}`);
        return { ...result, _verification: verificationResult };
      }
      
      // If verification failed, throw an error to trigger retry
      lastError = new Error(`Verification failed: ${verificationResult.message}`);
      console.error(`Verification failed on attempt ${attempt}: ${verificationResult.message}`);
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, etc.
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      lastError = error;
      console.error(`Error on attempt ${attempt}:`, error);
      
      // Wait before retrying
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error(`Failed to create document after ${maxRetries} attempts`);
}
```

## 4. Implement Transaction-like Pattern

For critical operations, implement a transaction-like pattern:

```typescript
async function createDocumentTransactional(
  doctype: string,
  values: Record<string, any>
): Promise<any> {
  // 1. Create a temporary log entry to track this operation
  const operationId = `create_${doctype}_${Date.now()}`;
  try {
    // Log the operation start
    await logOperation(operationId, 'start', { doctype, values });
    
    // 2. Attempt to create the document
    const result = await createDocumentWithRetry(doctype, values);
    
    // 3. Verify the document was created
    const verificationResult = await verifyDocumentCreation(doctype, values, result);
    
    // 4. Log the operation result
    await logOperation(operationId, verificationResult.success ? 'success' : 'failure', {
      result,
      verification: verificationResult
    });
    
    // 5. Return the result with verification info
    return {
      ...result,
      _verification: verificationResult
    };
  } catch (error) {
    // Log the operation error
    await logOperation(operationId, 'error', { error: (error as Error).message });
    throw error;
  }
}

async function logOperation(
  operationId: string,
  status: 'start' | 'success' | 'failure' | 'error',
  data: any
): Promise<void> {
  // This could write to a local log file, a database, or even a separate API
  console.error(`[Operation ${operationId}] ${status}:`, JSON.stringify(data, null, 2));
  
  // In a production system, you might want to persist this information
  // to help with debugging and recovery
}
```

## 5. Implement Health Checks

Add a health check function that can be called periodically to verify the API connection is working properly:

```typescript
export async function checkFrappeApiHealth(): Promise<{
  healthy: boolean;
  tokenAuth: boolean;
  passwordAuth: boolean;
  message: string;
}> {
  const result = {
    healthy: false,
    tokenAuth: false,
    passwordAuth: false,
    message: ""
  };
  
  try {
    // Try token authentication
    try {
      const tokenResponse = await frappe.db().getDocList("DocType", { limit: 1 });
      result.tokenAuth = true;
    } catch (tokenError) {
      result.tokenAuth = false;
    }
    
    // Try password authentication
    try {
      const authSuccess = await authenticateWithPassword();
      if (authSuccess) {
        const passwordResponse = await frappePassword.db().getDocList("DocType", { limit: 1 });
        result.passwordAuth = true;
      }
    } catch (passwordError) {
      result.passwordAuth = false;
    }
    
    // Set overall health status
    result.healthy = result.tokenAuth || result.passwordAuth;
    result.message = result.healthy 
      ? `API connection healthy. Token auth: ${result.tokenAuth}, Password auth: ${result.passwordAuth}`
      : "API connection unhealthy. Both authentication methods failed.";
    
    return result;
  } catch (error) {
    result.message = `Health check failed: ${(error as Error).message}`;
    return result;
  }
}
```

## Conclusion

These improvements would make the Frappe MCP server more robust against silent failures by:

1. Implementing thorough verification after document creation
2. Propagating verification failures as actual errors
3. Adding retry logic with exponential backoff
4. Creating a transaction-like pattern for critical operations
5. Implementing health checks to monitor API connectivity

By implementing these changes, the system would be better able to detect and report failures, improving data integrity and making debugging easier.