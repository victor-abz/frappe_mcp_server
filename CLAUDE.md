# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frappe MCP Server - A Model Context Protocol (MCP) server that bridges AI assistants (like Claude) and Frappe/ERPNext systems through the official REST API. It provides document CRUD operations, schema handling, and comprehensive API instructions.

## Development Commands

### Build and Run
```bash
npm run build           # Compile TypeScript to JavaScript
npm start              # Run stdio server (default)
npm run start-http     # Run HTTP server on port 51966
npm run start-streamable # Run Streamable HTTP server on port 51953

# Development mode
npm run dev            # Run stdio server with ts-node
npm run dev-http       # Run HTTP server with ts-node
npm run dev-streamable # Run Streamable HTTP server with ts-node
```

### Testing
```bash
# Unit and integration tests
npm run test-server    # Test server functionality
npm run test-tools     # Test tool operations
npm run test-mcp       # Test MCP protocol
npm run test-real      # Test with real Frappe instance
npm run test-http      # Test HTTP server

# Individual test scripts
node test-usage-info.js  # Test usage info enhancement
node test-with-real-frappe.js  # Real Frappe integration tests
```

### Publishing
```bash
npm run check-version   # Check current npm version
npm run suggest-version # Get version bump suggestion
npm run publish-patch   # Publish patch version
npm run publish-minor   # Publish minor version
npm run publish-major   # Publish major version
```

## Architecture Overview

The server supports three transport mechanisms:
1. **stdio** (default) - For Claude Desktop integration
2. **HTTP** - RESTful API on port 51966 (0xCAFE)
3. **Streamable HTTP** - Modern MCP transport on port 51953 (0xCAF1)

### Core Module Structure

- **Authentication** (`auth.ts`) - API key/secret validation
- **API Client** (`frappe-api.ts`, `api-client.ts`) - HTTP client with error handling
- **Document Operations** (`document-operations.ts`, `document-api.ts`) - CRUD operations
- **Schema Operations** (`schema-operations.ts`, `schema-api.ts`) - DocType metadata
- **Helper Tools** (`helper-tools.ts`) - Discovery and utility functions
- **Report Operations** (`report-operations.ts`) - Report generation and export
- **Static Hints** (`static-hints.ts`) - Pre-loaded DocType guidance
- **App Introspection** (`app-introspection.ts`) - Dynamic app discovery

### Tool Categories

1. **Document Operations** (6 tools)
   - create_document, get_document, update_document, delete_document, list_documents
   - reconcile_bank_transaction_with_vouchers (specialized)

2. **Schema Operations** (3 tools)
   - get_doctype_schema, get_field_options, get_frappe_usage_info

3. **Helper Tools** (9 tools)
   - find_doctypes, get_module_list, get_doctypes_in_module
   - check_doctype_exists, check_document_exists, get_document_count
   - get_naming_info, get_required_fields, get_api_instructions

4. **Report Tools** (7 tools)
   - run_query_report, get_report_meta, list_reports, export_report
   - get_financial_statements, get_report_columns, run_doctype_report

5. **Utility Tools** (3 tools)
   - call_method, version, ping

## Environment Configuration

Required environment variables:
```bash
FRAPPE_URL=https://your-frappe-instance.com  # Default: http://localhost:8000
FRAPPE_API_KEY=your_api_key                  # REQUIRED
FRAPPE_API_SECRET=your_api_secret            # REQUIRED
```

## Key Implementation Details

1. **Error Handling**: All operations include detailed error messages with context
2. **Validation**: Uses Zod for schema validation on all tool inputs
3. **Authentication**: Only supports API key/secret (no username/password)
4. **Modernized SDK**: Uses latest McpServer API with server.tool() registration

## Common Development Tasks

### Adding a New Tool
1. Define the tool function in the appropriate module (document/schema/helper)
2. Create Zod schema for input validation
3. Register with `server.tool()` in the setup function
4. Update documentation and examples

### Debugging
- Check `console.error()` outputs for server logs
- Use test scripts for isolated testing
- Environment variables in `test-config.env` for testing

### Type Safety
- All tool inputs validated with Zod schemas
- TypeScript strict mode enabled
- Consistent error handling patterns

## Testing Philosophy

### Core Principle: Real Data Only
- **NO MOCKS**: All tests use real Frappe instances with real data
- **NO STUBS**: All API calls hit actual endpoints
- **NO FALLBACKS**: If real systems fail, tests fail - this is valuable information
- **NO PLACEHOLDERS**: Every test uses production-like data and scenarios

### Professional Testing Strategy

**Test Framework**: Jest with TypeScript support
```bash
npm install --save-dev jest @types/jest ts-jest
```

**Test Structure**:
```
tests/
├── unit/
│   ├── auth.test.ts              # Real API authentication tests
│   ├── document-operations.test.ts # Real CRUD operations
│   ├── schema-operations.test.ts   # Real DocType queries  
├── integration/
│   ├── mcp-stdio.test.ts         # Real MCP protocol over stdio
│   ├── mcp-http.test.ts          # Real HTTP server testing
├── e2e/
│   └── full-workflow.test.ts     # Complete user scenarios
└── fixtures/
    └── test-data.sql             # Real test data setup
```

**Test Categories**:
1. **Unit Tests (70%)** - Hit real API endpoints, test actual responses
2. **Integration Tests (20%)** - Real MCP client-server communication  
3. **E2E Tests (10%)** - Full workflows with real Frappe operations

**Requirements**:
- Dedicated test Frappe instance
- Known test data sets  
- Real API credentials for testing
- Actual DocTypes and documents
- Real error scenarios

If the Frappe API is down, tests fail - that's correct behavior that provides valuable system health information.

## Important Notes

- The server requires valid API credentials to function
- Static hints are loaded from `src/server_hints/` at startup
- HTTP transports include CORS support for web integrations
- All document operations support field filtering for performance