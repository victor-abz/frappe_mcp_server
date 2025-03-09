import { createDocument, getDocument, updateDocument, deleteDocument, listDocuments, } from "./frappe-api.js";
// Export a handler function for document tool calls
export function handleDocumentToolCall(request) {
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
    // Handle document operations
    if (name === "create_document") {
        try {
            const doctype = args.doctype;
            const values = args.values;
            if (!doctype || !values) {
                return Promise.resolve({
                    content: [
                        {
                            type: "text",
                            text: "Missing required parameters: doctype and values",
                        },
                    ],
                    isError: true,
                });
            }
            return createDocument(doctype, values).then(result => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            })).catch(error => ({
                content: [
                    {
                        type: "text",
                        text: `Error creating document: ${error.message}`,
                    },
                ],
                isError: true,
            }));
        }
        catch (error) {
            return Promise.resolve({
                content: [
                    {
                        type: "text",
                        text: `Error creating document: ${error.message}`,
                    },
                ],
                isError: true,
            });
        }
    }
    else if (name === "get_document") {
        try {
            const doctype = args.doctype;
            const docName = args.name;
            const fields = args.fields;
            if (!doctype || !docName) {
                return Promise.resolve({
                    content: [
                        {
                            type: "text",
                            text: "Missing required parameters: doctype and name",
                        },
                    ],
                    isError: true,
                });
            }
            return getDocument(doctype, docName, fields).then(document => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(document, null, 2),
                    },
                ],
            })).catch(error => ({
                content: [
                    {
                        type: "text",
                        text: `Error retrieving document: ${error.message}`,
                    },
                ],
                isError: true,
            }));
        }
        catch (error) {
            return Promise.resolve({
                content: [
                    {
                        type: "text",
                        text: `Error retrieving document: ${error.message}`,
                    },
                ],
                isError: true,
            });
        }
    }
    else if (name === "update_document") {
        try {
            const doctype = args.doctype;
            const docName = args.name;
            const values = args.values;
            if (!doctype || !docName || !values) {
                return Promise.resolve({
                    content: [
                        {
                            type: "text",
                            text: "Missing required parameters: doctype, name, and values",
                        },
                    ],
                    isError: true,
                });
            }
            return updateDocument(doctype, docName, values).then(result => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            })).catch(error => ({
                content: [
                    {
                        type: "text",
                        text: `Error updating document: ${error.message}`,
                    },
                ],
                isError: true,
            }));
        }
        catch (error) {
            return Promise.resolve({
                content: [
                    {
                        type: "text",
                        text: `Error updating document: ${error.message}`,
                    },
                ],
                isError: true,
            });
        }
    }
    else if (name === "delete_document") {
        try {
            const doctype = args.doctype;
            const docName = args.name;
            if (!doctype || !docName) {
                return Promise.resolve({
                    content: [
                        {
                            type: "text",
                            text: "Missing required parameters: doctype and name",
                        },
                    ],
                    isError: true,
                });
            }
            return deleteDocument(doctype, docName).then(() => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ success: true }, null, 2),
                    },
                ],
            })).catch(error => ({
                content: [
                    {
                        type: "text",
                        text: `Error deleting document: ${error.message}`,
                    },
                ],
                isError: true,
            }));
        }
        catch (error) {
            return Promise.resolve({
                content: [
                    {
                        type: "text",
                        text: `Error deleting document: ${error.message}`,
                    },
                ],
                isError: true,
            });
        }
    }
    else if (name === "list_documents") {
        try {
            const doctype = args.doctype;
            const filters = args.filters;
            const fields = args.fields;
            const limit = args.limit;
            const order_by = args.order_by;
            const limit_start = args.limit_start;
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
            return listDocuments(doctype, filters, fields, limit, order_by, limit_start).then(documents => ({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(documents, null, 2),
                    },
                ],
            })).catch(error => ({
                content: [
                    {
                        type: "text",
                        text: `Error listing documents: ${error.message}`,
                    },
                ],
                isError: true,
            }));
        }
        catch (error) {
            return Promise.resolve({
                content: [
                    {
                        type: "text",
                        text: `Error listing documents: ${error.message}`,
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
                text: `Document operations module doesn't handle tool: ${name}`,
            },
        ],
        isError: true,
    });
}
export function setupDocumentTools(server) {
    // We no longer register tools here
    // Tools are now registered in the central handler in index.ts
    // This function is kept as a no-op to prevent import errors
    console.error("Document tools are now registered in the central handler in index.ts");
}
//# sourceMappingURL=document-operations.js.map