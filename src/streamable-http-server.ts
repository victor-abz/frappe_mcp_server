#!/usr/bin/env node

/**
 * Streamable HTTP-based Frappe MCP Server
 * Implements the modern MCP Streamable HTTP transport with optional SSE streaming
 */

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { initializeStaticHints } from './static-hints.js';
import { initializeAppIntrospection } from './app-introspection.js';
import { validateApiCredentials } from './auth.js';

// Import all tool functions
import { findDocTypes, getModuleList, getDocTypesInModule, doesDocTypeExist, doesDocumentExist, getDocumentCount, getNamingSeriesInfo, getRequiredFields } from './frappe-helpers.js';
import { getInstructions } from './frappe-instructions.js';
import { createDocument, getDocument, updateDocument, deleteDocument, listDocuments, callMethod } from './frappe-api.js';
import { getDocTypeSchema, getFieldOptions } from './frappe-api.js';
import { getDocTypeHints, getWorkflowHints, findWorkflowsForDocType } from './static-hints.js';
import { getDocTypeUsageInstructions, getAppForDocType, getAppUsageInstructions } from './app-introspection.js';

const app = express();
const port = process.env.PORT || 0xCAF1; // Port 51953 = 0xCAF1 (CAFE+1) in hex

// Session management
interface Session {
  id: string;
  clientId?: string;
  createdAt: Date;
  lastActivity: Date;
  messageQueue: any[];
}

const sessions = new Map<string, Session>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://claude.ai' : '*',
  credentials: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
}));
app.use(express.json({ limit: '4mb' }));

// Session middleware
app.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      req.session = session;
    }
  }
  
  next();
});

// Clean up expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity.getTime() > SESSION_TIMEOUT) {
      sessions.delete(id);
      console.log(`Session ${id} expired and removed`);
    }
  }
}, 60000); // Check every minute

// Tool definitions (same as http-server.ts)
const tools = {
  ping: {
    description: "A simple tool to check if the server is responding.",
    schema: z.object({}),
    handler: async () => ({ content: [{ type: "text", text: "pong" }] })
  },

  find_doctypes: {
    description: "Find DocTypes in the system matching a search term",
    schema: z.object({
      search_term: z.string().optional(),
      module: z.string().optional(),
      is_table: z.boolean().optional(),
      is_single: z.boolean().optional(),
      is_custom: z.boolean().optional(),
      limit: z.number().optional()
    }),
    handler: async (params: any) => {
      const result = await findDocTypes(params.search_term, {
        module: params.module,
        isTable: params.is_table,
        isSingle: params.is_single,
        isCustom: params.is_custom,
        limit: params.limit
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  get_module_list: {
    description: "Get a list of all modules in the system",
    schema: z.object({}),
    handler: async () => {
      const result = await getModuleList();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  check_doctype_exists: {
    description: "Check if a DocType exists in the system",
    schema: z.object({
      doctype: z.string()
    }),
    handler: async (params: any) => {
      const exists = await doesDocTypeExist(params.doctype);
      return { content: [{ type: "text", text: JSON.stringify({ exists }, null, 2) }] };
    }
  },

  get_doctype_schema: {
    description: "Get the complete schema for a DocType",
    schema: z.object({
      doctype: z.string()
    }),
    handler: async (params: any) => {
      const result = await getDocTypeSchema(params.doctype);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  },

  list_documents: {
    description: "List documents from Frappe with filters",
    schema: z.object({
      doctype: z.string(),
      filters: z.record(z.any()).optional(),
      fields: z.array(z.string()).optional(),
      limit: z.number().optional(),
      order_by: z.string().optional(),
      limit_start: z.number().optional()
    }),
    handler: async (params: any) => {
      const result = await listDocuments(
        params.doctype,
        params.filters,
        params.fields,
        params.limit,
        params.order_by,
        params.limit_start
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  }
};

// Helper to determine if a method should stream
function shouldStream(method: string): boolean {
  // Methods that might benefit from streaming
  const streamableMethods = [
    'tools/call', // Long-running tools
    'resources/read', // Large resource reads
    'prompts/run', // Interactive prompts
  ];
  
  return streamableMethods.some(m => method?.startsWith(m));
}

// Helper to send SSE message
function sendSSE(res: express.Response, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  res.write(message);
}

// Main MCP endpoint - Streamable HTTP
app.post('/', async (req, res) => {
  try {
    const { jsonrpc, method, params = {}, id } = req.body;
    
    // Validate JSON-RPC format
    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id || null,
        error: {
          code: -32600,
          message: "Invalid Request - must use JSON-RPC 2.0"
        }
      });
    }

    // Session handling for stateful operations
    let session = req.session;
    if (!session && method === 'initialize') {
      // Create new session
      session = {
        id: randomUUID(),
        createdAt: new Date(),
        lastActivity: new Date(),
        messageQueue: []
      };
      sessions.set(session.id, session);
      res.setHeader('x-session-id', session.id);
    }

    // Determine if we should stream the response
    const streaming = shouldStream(method) && req.headers.accept?.includes('text/event-stream');
    
    if (streaming) {
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'x-session-id': session?.id || ''
      });

      // Send initial response
      sendSSE(res, {
        jsonrpc: "2.0",
        id,
        result: {
          streaming: true,
          sessionId: session?.id
        }
      });

      // Keep connection alive
      const heartbeat = setInterval(() => {
        res.write(':heartbeat\n\n');
      }, 30000);

      // Clean up on disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        console.log(`SSE connection closed for session ${session?.id}`);
      });
    }

    // Handle MCP protocol methods
    switch (method) {
      case 'initialize': {
        const result = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {
              subscribe: false,
              listChanged: false
            },
            prompts: {},
            logging: {}
          },
          serverInfo: {
            name: "frappe-mcp-server",
            version: "0.2.16"
          },
          sessionId: session?.id
        };

        if (streaming) {
          sendSSE(res, { jsonrpc: "2.0", id, result });
          res.end();
        } else {
          res.json({ jsonrpc: "2.0", id, result });
        }
        break;
      }

      case 'tools/list': {
        const toolList = Object.entries(tools).map(([name, tool]) => ({
          name,
          description: tool.description,
          inputSchema: tool.schema.shape ? tool.schema._def.shape() : {}
        }));
        
        const result = { tools: toolList };

        if (streaming) {
          sendSSE(res, { jsonrpc: "2.0", id, result });
          res.end();
        } else {
          res.json({ jsonrpc: "2.0", id, result });
        }
        break;
      }

      case 'tools/call': {
        const { name: toolName, arguments: toolArgs = {} } = params;
        
        if (!toolName || !tools[toolName as keyof typeof tools]) {
          const error = {
            code: -32601,
            message: `Tool '${toolName}' not found`,
            data: { availableTools: Object.keys(tools) }
          };

          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, error });
            res.end();
          } else {
            res.status(404).json({ jsonrpc: "2.0", id, error });
          }
          return;
        }

        const toolDef = tools[toolName as keyof typeof tools];
        
        try {
          const validatedArgs = toolDef.schema.parse(toolArgs);
          
          if (streaming) {
            // Send progress updates for long-running operations
            sendSSE(res, {
              jsonrpc: "2.0",
              method: "tools/call/progress",
              params: {
                tool: toolName,
                status: "started"
              }
            });
          }

          const result = await toolDef.handler(validatedArgs);
          
          if (streaming) {
            sendSSE(res, { jsonrpc: "2.0", id, result });
            res.end();
          } else {
            res.json({ jsonrpc: "2.0", id, result });
          }
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0",
            id,
            error: {
              code: error instanceof z.ZodError ? -32602 : -32603,
              message: error instanceof Error ? error.message : 'Internal error',
              data: error instanceof z.ZodError ? error.errors : undefined
            }
          };

          if (streaming) {
            sendSSE(res, errorResponse);
            res.end();
          } else {
            res.status(500).json(errorResponse);
          }
        }
        break;
      }

      case 'notifications/message': {
        // Handle notifications (no response expected)
        if (id) {
          res.status(400).json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32600,
              message: "Notifications should not include an id"
            }
          });
        } else {
          res.status(204).end(); // No content for notifications
        }
        break;
      }

      default: {
        const error = {
          code: -32601,
          message: `Method '${method}' not found`
        };

        if (streaming) {
          sendSSE(res, { jsonrpc: "2.0", id, error });
          res.end();
        } else {
          res.status(404).json({ jsonrpc: "2.0", id, error });
        }
      }
    }

  } catch (error) {
    console.error('Error in Streamable HTTP handler:', error);
    
    const errorResponse = {
      jsonrpc: "2.0",
      id: req.body.id || null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    };

    if (res.headersSent) {
      // If we're streaming and headers are sent, send error via SSE
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.end();
    } else {
      res.status(500).json(errorResponse);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    server: 'frappe-mcp-server',
    version: '0.2.16',
    transport: 'streamable-http',
    sessions: sessions.size
  });
});

// Server info endpoint
app.get('/info', (req, res) => {
  const toolNames = Object.keys(tools);
  res.json({
    name: "frappe-mcp-server",
    version: "0.2.16",
    transport: "streamable-http",
    protocol: "2024-11-05",
    capabilities: {
      streaming: true,
      stateful: true
    },
    tools: toolNames.length,
    availableTools: toolNames,
    endpoints: {
      mcp: '/',
      health: '/health',
      info: '/info'
    }
  });
});

async function startServer() {
  try {
    console.log("Starting Frappe MCP Streamable HTTP server...");
    
    // Validate credentials
    await validateApiCredentials();
    console.log("API credentials validation successful.");

    // Initialize components
    console.log("Initializing static hints...");
    await initializeStaticHints();
    console.log("Static hints initialized successfully");

    console.log("Initializing app introspection...");
    await initializeAppIntrospection();
    console.log("App introspection initialized successfully");

    // Start server
    app.listen(port, () => {
      console.log(`🚀 Frappe MCP server running with Streamable HTTP at http://localhost:${port}`);
      console.log(`☕ Port ${port} = 0xCAF1 in hexadecimal. The next evolution of Frappe Café!`);
      console.log(`📋 Endpoints:`);
      console.log(`   POST /          - MCP Streamable HTTP endpoint (JSON-RPC 2.0)`);
      console.log(`   GET  /health    - Health check`);
      console.log(`   GET  /info      - Server information`);
      console.log(`\n✨ Features:`);
      console.log(`   - Streamable HTTP transport with optional SSE`);
      console.log(`   - Stateful sessions with automatic cleanup`);
      console.log(`   - JSON and SSE response formats`);
      console.log(`   - Full MCP protocol compliance`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Frappe MCP Streamable HTTP server...');
  sessions.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Frappe MCP Streamable HTTP server...');
  sessions.clear();
  process.exit(0);
});

// Add type declaration for session
declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

startServer();