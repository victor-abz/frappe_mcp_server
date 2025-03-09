#!/usr/bin/env node
import { spawn } from 'child_process';
import { createInterface } from 'readline';

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

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'MCP Test> ',
});

// Handle server output
server.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log('\nServer Response:');
    console.log(JSON.stringify(response, null, 2));
    rl.prompt();
  } catch (error) {
    console.error('\nError parsing server response:', error);
    console.log('Raw response:', data.toString());
    rl.prompt();
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  rl.close();
  process.exit(1);
});

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  rl.close();
  process.exit(code);
});

// Print instructions
console.log('Frappe MCP Server Test Client');
console.log('----------------------------');
console.log('Enter JSON requests to send to the server.');
console.log('Example: { "method": "tools/list" }');
console.log('Type "exit" to quit.');
console.log('');

// Handle user input
rl.prompt();
rl.on('line', (line) => {
  const input = line.trim();
  
  if (input.toLowerCase() === 'exit') {
    console.log('Exiting...');
    server.kill();
    rl.close();
    process.exit(0);
  }
  
  try {
    // Parse and send the JSON request
    const request = JSON.parse(input);
    server.stdin.write(JSON.stringify(request) + '\n');
  } catch (error) {
    console.error('Error parsing input:', error.message);
    rl.prompt();
  }
}).on('close', () => {
  console.log('Test client closed');
  server.kill();
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down...');
  server.kill();
  rl.close();
  process.exit(0);
});