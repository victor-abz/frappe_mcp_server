# Frappe MCP Server

A Model Context Protocol (MCP) server for Frappe Framework that exposes Frappe's functionality to AI assistants through the official REST API, with a focus on document CRUD operations, schema handling, and detailed API instructions.

## Overview

This MCP server allows AI assistants to interact with Frappe applications through a standardized interface using the official Frappe REST API. It provides tools for:

- Document operations (create, read, update, delete, list)
- Schema and metadata handling
- DocType discovery and exploration
- Detailed API usage instructions and examples

The server includes comprehensive error handling, validation, and helpful responses to make it easier for AI assistants to work with Frappe.

## Installation

### Prerequisites

- Node.js 18 or higher
- A running Frappe instance (version 13 or higher)
- API key and secret from Frappe (optional but recommended)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/frappe-mcp-server.git
cd frappe-mcp-server
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Configuration

The server can be configured using environment variables:

- `FRAPPE_URL`: The URL of your Frappe instance (default: `http://localhost:8000`)
- `FRAPPE_API_KEY`: Your Frappe API key
- `FRAPPE_API_SECRET`: Your Frappe API secret

### Getting API Credentials

To get API credentials from your Frappe instance:

1. Go to User > API Access > New API Key
2. Select the user for whom you want to create the key
3. Click "Generate Keys"
4. Copy the API Key and API Secret

## Usage

### Starting the Server

```bash
npm start
```

Or with environment variables:

```bash
FRAPPE_URL=https://your-frappe-instance.com FRAPPE_API_KEY=your_api_key FRAPPE_API_SECRET=your_api_secret npm start
```

### Integrating with AI Assistants

To use this MCP server with an AI assistant, you need to configure the assistant to connect to this server. The exact configuration depends on the AI assistant platform you're using.

For Claude, add the following to your MCP settings configuration file:

```json
{
  "mcpServers": {
    "frappe": {
      "command": "node",
      "args": ["/path/to/frappe-mcp-server/build/index.js"],
      "env": {
        "FRAPPE_URL": "https://your-frappe-instance.com",
        "FRAPPE_API_KEY": "your_api_key",
        "FRAPPE_API_SECRET": "your_api_secret"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

## Available Tools

### Document Operations

- `create_document`: Create a new document in Frappe
- `get_document`: Retrieve a document from Frappe
- `update_document`: Update an existing document in Frappe
- `delete_document`: Delete a document from Frappe
- `list_documents`: List documents from Frappe with filters

### Schema Operations

- `get_doctype_schema`: Get the complete schema for a DocType including field definitions, validations, and linked DocTypes
- `get_field_options`: Get available options for a Link or Select field

### Helper Tools

- `find_doctypes`: Find DocTypes in the system matching a search term
- `get_module_list`: Get a list of all modules in the system
- `get_doctypes_in_module`: Get a list of DocTypes in a specific module
- `check_doctype_exists`: Check if a DocType exists in the system
- `check_document_exists`: Check if a document exists
- `get_document_count`: Get a count of documents matching filters
- `get_naming_info`: Get the naming series information for a DocType
- `get_required_fields`: Get a list of required fields for a DocType
- `get_api_instructions`: Get detailed instructions for using the Frappe API

## Available Resources

### Schema Resources

- `schema://{doctype}`: Schema information for a DocType
- `schema://{doctype}/{fieldname}/options`: Available options for a Link or Select field
- `schema://modules`: List of all modules in the system
- `schema://doctypes`: List of all DocTypes in the system

## Examples

### Creating a Document

```javascript
// Example of using the create_document tool
const result = await useToolWithMcp("frappe", "create_document", {
  doctype: "Customer",
  values: {
    customer_name: "John Doe",
    customer_type: "Individual",
    customer_group: "All Customer Groups",
    territory: "All Territories",
  },
});
```

### Getting a Document

```javascript
// Example of using the get_document tool
const customer = await useToolWithMcp("frappe", "get_document", {
  doctype: "Customer",
  name: "CUST-00001",
  fields: ["customer_name", "customer_type", "email_id"], // Optional: specific fields
});
```

### Listing Documents with Filters

```javascript
// Example of using the list_documents tool with filters
const customers = await useToolWithMcp("frappe", "list_documents", {
  doctype: "Customer",
  filters: {
    customer_type: "Individual",
    territory: "United States",
  },
  fields: ["name", "customer_name", "email_id"],
  limit: 10,
  order_by: "creation desc",
});
```

### Finding DocTypes

```javascript
// Example of using the find_doctypes tool
const salesDocTypes = await useToolWithMcp("frappe", "find_doctypes", {
  search_term: "Sales",
  module: "Selling",
  is_table: false,
});
```

### Getting Required Fields

```javascript
// Example of using the get_required_fields tool
const requiredFields = await useToolWithMcp("frappe", "get_required_fields", {
  doctype: "Sales Order",
});
```

### Getting API Instructions

```javascript
// Example of using the get_api_instructions tool
const instructions = await useToolWithMcp("frappe", "get_api_instructions", {
  category: "DOCUMENT_OPERATIONS",
  operation: "CREATE",
});
```

## Error Handling

The server provides detailed error messages with context to help diagnose issues:

- Missing required parameters
- Invalid field values
- Permission errors
- Network issues
- Server errors

Each error includes:

- A descriptive message
- HTTP status code (when applicable)
- Endpoint information
- Additional details from the Frappe server

## Best Practices

1. **Check DocType Schema First**: Before creating or updating documents, get the schema to understand required fields and validations.

2. **Use Pagination**: When listing documents, use `limit` and `limit_start` parameters to paginate results.

3. **Specify Fields**: Only request the fields you need to improve performance.

4. **Validate Before Creating**: Use `get_required_fields` to ensure you have all required fields before creating a document.

5. **Check Existence**: Use `check_document_exists` before updating or deleting to ensure the document exists.

## License

ISC
