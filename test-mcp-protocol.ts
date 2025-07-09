#!/usr/bin/env node

/**
 * MCP Protocol Level Testing
 * Tests the server using the official MCP TypeScript client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
}

class MCPTester {
  private client: Client;
  private transport: StdioClientTransport;
  private results: TestResult[] = [];

  constructor() {
    this.transport = new StdioClientTransport({
      command: "node",
      args: [join(__dirname, "build/index.js")],
      env: {
        ...process.env,
        FRAPPE_API_KEY: "test_key_for_testing",
        FRAPPE_API_SECRET: "test_secret_for_testing",
        FRAPPE_BASE_URL: "http://localhost:8000"
      }
    });

    this.client = new Client({
      name: "mcp-test-client",
      version: "1.0.0"
    });
  }

  async connect(): Promise<void> {
    console.log("🔌 Connecting to MCP server...");
    await this.client.connect(this.transport);
    console.log("✅ Connected successfully!");
  }

  async disconnect(): Promise<void> {
    console.log("🔌 Disconnecting from MCP server...");
    await this.client.close();
    console.log("✅ Disconnected successfully!");
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await testFn();
      const duration = Date.now() - start;
      this.results.push({ name, success: true, duration });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({ 
        name, 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        duration 
      });
      console.log(`❌ ${name} (${duration}ms): ${error}`);
    }
  }

  async runAllTests(): Promise<void> {
    console.log("🧪 Starting MCP Protocol Tests...\n");

    // Test 1: List Tools
    await this.runTest("List Tools", async () => {
      const response = await this.client.listTools();
      if (!response.tools || response.tools.length === 0) {
        throw new Error("No tools returned");
      }
      console.log(`   Found ${response.tools.length} tools`);
      
      // Verify expected tools exist
      const expectedTools = ["ping", "create_document", "get_document", "list_documents"];
      for (const tool of expectedTools) {
        if (!response.tools.some(t => t.name === tool)) {
          throw new Error(`Expected tool '${tool}' not found`);
        }
      }
    });

    // Test 2: Call Ping Tool
    await this.runTest("Call Ping Tool", async () => {
      const response = await this.client.callTool({
        name: "ping",
        arguments: {}
      });
      if (!response.content || response.content.length === 0) {
        throw new Error("No content returned");
      }
      const textContent = response.content.find(c => c.type === "text");
      if (!textContent || textContent.text !== "pong") {
        throw new Error(`Expected 'pong', got '${textContent?.text}'`);
      }
    });

    // Test 3: Test Input Validation
    await this.runTest("Test Input Validation", async () => {
      try {
        await this.client.callTool({
          name: "get_document",
          arguments: {} // Missing required fields
        });
        throw new Error("Should have failed with validation error");
      } catch (error) {
        // Expected to fail
        if (!error.message.includes("doctype") && !error.message.includes("name")) {
          throw new Error(`Unexpected error message: ${error.message}`);
        }
      }
    });

    // Test 4: Test Schema Tools
    await this.runTest("Test Schema Tools", async () => {
      const tools = await this.client.listTools();
      const schemaTool = tools.tools.find(t => t.name === "get_doctype_schema");
      if (!schemaTool) {
        throw new Error("Schema tool not found");
      }
      
      // This will fail with auth error, but we're testing that the tool exists and validates input
      try {
        await this.client.callTool({
          name: "get_doctype_schema",
          arguments: { doctype: "User" }
        });
      } catch (error) {
        // Expected to fail with auth error, not validation error
        if (!error.message.includes("auth") && !error.message.includes("Authentication")) {
          throw new Error(`Unexpected error type: ${error.message}`);
        }
      }
    });

    // Test 5: Test Helper Tools
    await this.runTest("Test Helper Tools", async () => {
      const tools = await this.client.listTools();
      const helperTool = tools.tools.find(t => t.name === "find_doctypes");
      if (!helperTool) {
        throw new Error("Helper tool not found");
      }
      
      // Test with optional parameters
      try {
        await this.client.callTool({
          name: "find_doctypes",
          arguments: { search_term: "User", limit: 5 }
        });
      } catch (error) {
        // Expected to fail with auth error
        if (!error.message.includes("auth") && !error.message.includes("Authentication")) {
          throw new Error(`Unexpected error type: ${error.message}`);
        }
      }
    });

    // Test 6: Test Tool Discovery
    await this.runTest("Test Tool Discovery", async () => {
      const tools = await this.client.listTools();
      
      // Verify all expected tools are present
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
        if (!actualToolNames.includes(expectedTool)) {
          throw new Error(`Missing tool: ${expectedTool}`);
        }
      }
      
      console.log(`   All ${expectedToolNames.length} expected tools found`);
    });

    // Test 7: Test Error Handling
    await this.runTest("Test Error Handling", async () => {
      try {
        await this.client.callTool({
          name: "nonexistent_tool",
          arguments: {}
        });
        throw new Error("Should have failed with tool not found error");
      } catch (error) {
        if (!error.message.includes("Unknown tool") && !error.message.includes("not found")) {
          throw new Error(`Unexpected error message: ${error.message}`);
        }
      }
    });

    this.printResults();
  }

  private printResults(): void {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 MCP Protocol Test Results");
    console.log("=".repeat(60));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    console.log(`\n📊 Summary: ${passed}/${total} tests passed`);
    
    if (failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  • ${result.name}: ${result.error}`);
      });
    }
    
    console.log("\n⏱️  Performance:");
    this.results.forEach(result => {
      const status = result.success ? "✅" : "❌";
      console.log(`  ${status} ${result.name}: ${result.duration}ms`);
    });
    
    const avgDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / this.results.length;
    console.log(`\n📈 Average test duration: ${avgDuration.toFixed(2)}ms`);
    
    if (failed === 0) {
      console.log("\n🎉 All tests passed!");
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed`);
    }
  }
}

// Main execution
async function main() {
  const tester = new MCPTester();
  
  try {
    await tester.connect();
    await tester.runAllTests();
  } catch (error) {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  } finally {
    await tester.disconnect();
  }
}

main().catch(console.error);