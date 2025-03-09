// This file has been removed as part of the recalibration to only use documented REST API endpoints.
// Direct database access is no longer supported in this MCP server.
// Please use the document and schema operations which use the official Frappe REST API.
export function setupDatabaseTools(server) {
    // This function is kept as a no-op to prevent import errors,
    // but it no longer registers any database tools.
    console.error("Database tools have been removed from the MCP server.");
}
export function handleDatabaseToolCall(request) {
    // This function is kept to prevent import errors,
    // but it always returns an error response.
    return Promise.resolve({
        content: [
            {
                type: "text",
                text: "Direct database access has been removed from the MCP server. Please use the document and schema operations instead.",
            },
        ],
        isError: true,
    });
}
//# sourceMappingURL=database-access.js.map