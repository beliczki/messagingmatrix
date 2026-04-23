// Auth middleware for the MCP server.
// Accepts either:
//   (a) `?secret=<token>` query string — matches claude.ai connector convention
//   (b) `Authorization: Bearer <token>` header — standard MCP client convention
// Token read from MCP_BEARER_TOKEN at request time.

export function requireBearer(req, res, next) {
  const token = process.env.MCP_BEARER_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: 'MCP is not configured: set MCP_BEARER_TOKEN in .env to enable',
    });
  }

  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : '';
  const header = req.headers.authorization || '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (querySecret === token || headerToken === token) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}
