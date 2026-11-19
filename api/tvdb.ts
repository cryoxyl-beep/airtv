import { ApiError, createApiHandler } from './_lib/http.js';
import { executeTvdbProxyRequest, validateTvdbRequest } from './_lib/tvdb.js';

export default createApiHandler(
  {
    allowedMethods: ['GET'],
    timeoutMs: 9000,
    cacheControl: 'no-store',
  },
  async (req, res, ctx) => {
    // Reject any client Authorization header: TVDB authentication is strictly server-side.
    if (req.headers.authorization !== undefined) {
      throw new ApiError(
        400,
        'AUTH_NOT_SUPPORTED',
        'Authorization headers are not permitted on this public TVDB endpoint.'
      );
    }

    const validated = validateTvdbRequest(ctx.query);
    const result = await executeTvdbProxyRequest(validated, {
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
    res.setHeader('X-Miyoro-Tvdb-Op', result.operation);
    res.setHeader('Content-Length', Buffer.byteLength(result.bodyText, 'utf8'));
    res.end(result.bodyText);
  }
);
