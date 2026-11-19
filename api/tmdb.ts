import { createApiHandler } from './_lib/http.js';
import { executeTmdbProxyRequest, validateTmdbRequest } from './_lib/tmdb.js';

export default createApiHandler(
  {
    allowedMethods: ['GET'],
    timeoutMs: 9000,
    cacheControl: 'no-store',
  },
  async (req, res, ctx) => {
    const validated = validateTmdbRequest(ctx.url.pathname, ctx.query, req.url);
    const result = await executeTmdbProxyRequest(validated, {
      signal: ctx.signal,
    });

    if (res.writableEnded || res.headersSent) {
      return;
    }

    res.statusCode = result.statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', result.cacheControl);
    res.setHeader('X-Miyoro-Cache-Policy', result.cachePolicy);
    res.setHeader('X-Miyoro-Cache', result.cacheStatus);
    res.setHeader('Content-Length', Buffer.byteLength(result.bodyText, 'utf8'));
    res.end(result.bodyText);
  }
);
