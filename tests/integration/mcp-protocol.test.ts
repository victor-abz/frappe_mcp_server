/**
 * MCP Protocol Level Testing
 * Tests the server using the official MCP TypeScript client
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('MCP Protocol Integration (Real Frappe API)', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: [join(__dirname, "../../build/index.js")],
      env: {
        ...process.env,
        FRAPPE_API_KEY: "ff09790d111aeab",
        FRAPPE_API_SECRET: "d3bc10957fd898f", 
        FRAPPE_URL: "https://epinomy.com"
      }
    });

    client = new Client({
      name: "mcp-test-client",
      version: "1.0.0"
    });

    await client.connect(transport);
  }, 10000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  test('should list all available tools', async () => {
    const response = await client.listTools();
    
    expect(response).toBeDefined();
    expect(response.tools).toBeDefined();
    expect(response.tools.length).toBeGreaterThan(0);
    
    // Verify expected tools exist
    const expectedTools = ["ping", "create_document", "get_document", "list_documents"];
    for (const tool of expectedTools) {
      expect(response.tools.some(t => t.name === tool)).toBe(true);
    }
  });

  test('should successfully call ping tool', async () => {
    const response = await client.callTool({
      name: "ping",
      arguments: {}
    });
    
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    
    const textContent = response.content.find(c => c.type === "text");
    expect(textContent).toBeDefined();
    expect(textContent.text).toBe("pong");
  });

  test('should validate input parameters', async () => {
    await expect(client.callTool({
      name: "get_document",
      arguments: {} // Missing required fields
    })).rejects.toThrow();
  });

  test('should call schema tools successfully', async () => {
    const tools = await client.listTools();
    const schemaTool = tools.tools.find(t => t.name === "get_doctype_schema");
    
    expect(schemaTool).toBeDefined();
    
    // Test with User DocType
    const response = await client.callTool({
      name: "get_doctype_schema",
      arguments: { doctype: "User" }
    });
    
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
  });

  test('should call helper tools successfully', async () => {
    const tools = await client.listTools();
    const helperTool = tools.tools.find(t => t.name === "find_doctypes");
    
    expect(helperTool).toBeDefined();
    
    const response = await client.callTool({
      name: "find_doctypes",
      arguments: { search_term: "User", limit: 5 }
    });
    
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
  });

  test('should discover all expected tools', async () => {
    const tools = await client.listTools();
    
    const expectedToolNames = [
      "ping", "call_method",
      "create_document", "get_document", "update_document", "delete_document", "list_documents",
      "reconcile_bank_transaction_with_vouchers",
      "get_doctype_schema", "get_field_options", "get_frappe_usage_info",
      "find_doctypes", "get_module_list", "get_doctypes_in_module",
      "check_doctype_exists", "check_document_exists", "get_document_count",
      "get_naming_info", "get_required_fields", "get_api_instructions"
    ];
    
    const actualToolNames = tools.tools.map(t => t.name);
    
    for (const expectedTool of expectedToolNames) {
      expect(actualToolNames).toContain(expectedTool);
    }
    
    expect(actualToolNames.length).toBeGreaterThanOrEqual(expectedToolNames.length);
  });

  test('should handle unknown tools gracefully', async () => {
    await expect(client.callTool({
      name: "nonexistent_tool",
      arguments: {}
    })).rejects.toThrow();
  });

  test('should handle document operations via MCP', async () => {
    const response = await client.callTool({
      name: "list_documents",
      arguments: {
        doctype: "File",
        fields: ["name", "file_name"],
        limit: 3
      }
    });
    
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    
    const textContent = response.content.find(c => c.type === "text");
    expect(textContent).toBeDefined();
    
    // The response should contain either formatted message or JSON data
    expect(textContent.text).toBeTruthy();
    expect(textContent.text.length).toBeGreaterThan(50); // Should have meaningful content
    
    // Should contain array structure (direct JSON) or formatted message
    expect(textContent.text).toMatch(/(\[|\{|Documents retrieved)/);
  });
});