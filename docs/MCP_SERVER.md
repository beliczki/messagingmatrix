# MCP Server

Each messaging matrix deployment exposes a Model Context Protocol (MCP) endpoint at `<subdomain>/mcp`. Plug it into Claude Desktop, Cowork, or any MCP-speaking client and you get 17 tools for reading and editing audiences, topics, and MCs.

## Endpoints

| Deployment | MCP URL |
|---|---|
| Erste     | `https://erste.messagingmatrix.ai/mcp` |
| Telekom   | `https://telekom.messagingmatrix.ai/mcp` |
| Proficio  | `https://proficio.messagingmatrix.ai/mcp` |
| Demo      | `https://demo.messagingmatrix.ai/mcp` |
| Local dev | `http://localhost:3003/mcp` |

Each deployment uses its own Google Sheets spreadsheet + service account + bearer token. The token lives in the instance's `.env` as `MCP_BEARER_TOKEN`.

## Transport

**Streamable HTTP (stateless).** One POST per JSON-RPC message. The response is either a JSON body or an SSE stream depending on the tool's behavior.

## Authentication

Two equivalent ways to pass the token:

- **Query string:** `https://erste.messagingmatrix.ai/mcp/?secret=<MCP_BEARER_TOKEN>` — use this for claude.ai connectors, which accept a single URL and have no headers UI.
- **Header:** `Authorization: Bearer <MCP_BEARER_TOKEN>` — use this for Claude Desktop local config, curl, or any client that controls headers.

Either one alone is sufficient.

- Missing / wrong token → `401 Unauthorized`.
- `MCP_BEARER_TOKEN` env var not set on the server → `503 Service Unavailable`.

Generate a fresh token per instance:

```bash
openssl rand -hex 32
```

Put it in the instance's `.env`, restart PM2, and paste the same value into your MCP client config (as the URL `?secret=...` or as the `Authorization: Bearer ...` header).

## Claude.ai connectors (recommended)

Go to Claude.ai settings → Connectors → Add remote MCP server.

- **Type:** Streamable HTTP (or "HTTP" depending on the UI label — whichever corresponds to the MCP Streamable HTTP transport)
- **URL:** `https://erste.messagingmatrix.ai/mcp/?secret=<MCP_BEARER_TOKEN>` (include the trailing slash before the `?`)
- Repeat per instance with that instance's token.

Once connected it shows up in every Claude surface (claude.ai, Claude Desktop, Cowork).

## Claude Desktop local config (alternative)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mm-erste": {
      "url": "https://erste.messagingmatrix.ai/mcp/",
      "headers": { "Authorization": "Bearer <your-token-here>" }
    }
  }
}
```

Restart Claude Desktop.

## Tools (17)

### Write
- `audience_create`, `audience_remove`, `audience_update`
- `topic_create`, `topic_remove`, `topic_update`
- `mc_create`, `mc_remove`, `mc_update`

### Read
- `list_audiences(product?)`
- `list_topics(product?)`
- `list_mc(topic_key?, audience_key?, product?, status?, monitoring_status?)`
- `mc_get(mc_label)`

### Reporting
- `get_mc_reporting(mc_label)` — reads the `Reporting` sheet (populated by Monitoring → AdForm Sync)

### Meta
- `list_templates()`
- `list_products()`
- `matrix_status()`

## Caveats

1. **Concurrency with the UI.** MCP writes land directly on Google Sheets. If the matrix UI is open with unsaved edits and you click Save after an MCP change, the UI's full-table rewrite will clobber MCP's changes. Rule of thumb: **save any pending UI edits before running MCP tools, and reload the UI after to see MCP's changes.**

2. **PMMID regeneration.** `mc_update` auto-regenerates PMMID + trafficking fields when you change `audience_key`, `topic_key`, `number`, `variant`, or `version`. Other fields don't trigger regeneration.

3. **Topic key regeneration.** `topic_update` auto-regenerates the topic key when `product`, `tag1`, `tag2`, `tag3`, or `tag4` change (matching the frontend behavior in `useMatrix.updateTopic`).

4. **Reporting data freshness.** `get_mc_reporting` and `list_mc (monitoring_status=...)` read the `Reporting` sheet as-of the last Monitoring → AdForm Sync. Run the sync from the Monitoring page to refresh.

5. **`mc_preview_image` is not implemented yet.** Deferred — requires a headless browser on the server. See `memory/mcp_preview_deferred.md`.

## Smoke test

With the server running locally:

```bash
export TOK="your-token"

# Handshake
curl -sX POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# List tools
curl -sX POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Expect 17 entries in the `tools` array.
