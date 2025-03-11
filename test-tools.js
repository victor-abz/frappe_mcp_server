#!/usr/bin/env node
import { spawn } from 'child_process';

// Start the MCP server as a child process
const server = spawn('node', ['build/index.js'], {
  env: {
    ...process.env,
    FRAPPE_URL: process.env.FRAPPE_URL || 'http://localhost:8000',
    FRAPPE_API_KEY: process.env.FRAPPE_API_KEY,
    FRAPPE_API_SECRET: process.env.FRAPPE_API_SECRET,
  },
  stdio: ['pipe', 'pipe', process.stderr],
});

// Test case for create_document (simplified)
async function testCreateDocument() {
  console.log('\nSending request to create_document (simplified)...');
  const createRequest = {
    jsonrpc: "2.0",
    id: "2",
    method: "tools/call",
    params: {
      tool_name: "create_document",
      arguments: {
        doctype: "Note",
        values: {
          title: "Minimal Test Note" // Only required title field
        }
      }
    }
  };
  server.stdin.write(JSON.stringify(createRequest) + '\n');
}

// Handle server output
server.stdout.on('data', (data) => {
  const responses = data.toString().split('\n').filter(line => line.trim() !== ''); // Split by newline and filter empty lines
  responses.forEach(responseLine => { // Iterate over each response line
    try {
      const response = JSON.parse(responseLine);
      console.log('\nServer Response:');
      console.log(JSON.stringify(response, null, 2));

      // Check if database tools are present (existing check)
      if (response.result && response.result.tools) {
        const databaseTools = response.result.tools.filter(
          tool => tool.name === 'execute_sql' || tool.name === 'get_table_schema'
        );

        if (databaseTools.length > 0) {
          console.log('\n⚠️ WARNING: Database tools are still present:');
          console.log(JSON.stringify(databaseTools, null, 2));
        } else {
          console.log('\n✅ SUCCESS: No database tools found in the response.');
        }
      }

      // Check for create_document success
      if (response.result && response.result.content && response.result.content[0].text.startsWith('Document created successfully')) {
        console.log('\n✅ SUCCESS: create_document tool test passed!');
      } else if (response.error) {
        console.error('\n❌ ERROR: Server returned an error:', response.error);
      }


      // Exit after receiving the response
      setTimeout(() => {
        server.kill();
        process.exit(response.error ? 1 : 0); // Exit with error code if there was an error
      }, 500);
    } catch (error) {
      console.error('\nError parsing server response:', error);
      console.log('Raw response:', responseLine); // Log the raw response line that caused the error
      server.kill();
      process.exit(1);
    }
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Send the request to list all tools using JSON-RPC 2.0 format
console.log('Sending request to list all tools...');
const request = {
  jsonrpc: "2.0",
  id: "1",
  method: "tools/list",
  params: {}
};
server.stdin.write(JSON.stringify(request) + '\n');

// Call testCreateDocument after listing tools
testCreateDocument();