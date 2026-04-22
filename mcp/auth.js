// Bearer-token middleware for the MCP server.
// Token is read from MCP_BEARER_TOKEN at request time (so env changes pick up
// without restart, useful for testing).

export function requireBearer(req, res, next) {
  const token = process.env.MCP_BEARER_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: 'MCP is not configured: set MCP_BEARER_TOKEN in .env to enable',
    });
  }
  const header = req.headers.authorization || '';
  if (header !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
