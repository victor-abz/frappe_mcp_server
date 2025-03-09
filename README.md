# Frappe MCP Server

A Model Context Protocol (MCP) server for Frappe Framework that exposes Frappe's functionality to AI assistants through the official REST API, with a focus on document CRUD operations and schema handling.

## Overview

This MCP server allows AI assistants to interact with Frappe applications through a standardized interface using the official Frappe REST API. It provides tools for:

- Document operations (create, read, update, delete, list)
- Schema and metadata handling

## Installation

### Prerequisites

- Node.js 18 or higher
- A running Frappe instance
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

- `get_doctype_schema`: Get the complete schema for a DocType
- `get_field_options`: Get available options for a Link or Select field

## Available Resources

### Schema Resources

- `schema://{doctype}`: Schema information for a DocType
- `schema://{doctype}/{fieldname}/options`: Available options for a Link or Select field

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
});
```

### Getting DocType Schema

```javascript
// Example of using the get_doctype_schema tool
const schema = await useToolWithMcp("frappe", "get_doctype_schema", {
  doctype: "Customer",
});
```

## License

ISC
