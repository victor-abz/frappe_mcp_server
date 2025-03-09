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

// Handle server output
server.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log('\nServer Response:');
    console.log(JSON.stringify(response, null, 2));
    
    // Check if database tools are present
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
    
    // Exit after receiving the response
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 500);
  } catch (error) {
    console.error('\nError parsing server response:', error);
    console.log('Raw response:', data.toString());
    server.kill();
    process.exit(1);
  }
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