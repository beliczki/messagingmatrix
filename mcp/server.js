// MCP server module — mounts as an Express sub-router at /mcp.
//
// Transport: Streamable HTTP in stateless mode (no session ids). One McpServer
// instance is built at module load with all 17 tools registered. For every
// incoming POST we spin up a fresh transport, wire it to the shared server,
// and hand the request off.
//
// Auth: `requireBearer` middleware runs before any MCP handling.

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { requireBearer } from './auth.js';
import { registerAudienceTools } from './tools/audiences.js';
import { registerTopicTools } from './tools/topics.js';
import { registerMessageTools } from './tools/messages.js';
import { registerMetaTools } from './tools/meta.js';

export function createMcpRouter({ getAccessToken, getSpreadsheetId, getSqlite, version }) {
  const server = new McpServer({
    name: 'messagingmatrix-mcp',
    version: version || '5.1.0',
  });

  const ctx = { getAccessToken, getSpreadsheetId, getSqlite };
  registerAudienceTools(server, ctx);
  registerTopicTools(server, ctx);
  registerMessageTools(server, ctx);
  registerMetaTools(server, ctx);

  const router = express.Router();
  router.use(requireBearer);

  // Streamable HTTP transport handles POST (client→server messages),
  // GET (optional server→client SSE stream), and DELETE (session terminate).
  // Route all three to the same handler; let the SDK transport decide what's valid.
  const handleMcp = async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        try { transport.close(); } catch { /* ignore */ }
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('[MCP] request failed:', error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: error.message }, id: null });
      }
    }
  };

  router.post('/', handleMcp);
  router.get('/', handleMcp);
  router.delete('/', handleMcp);

  return router;
}
