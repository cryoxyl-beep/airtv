import {
  ANILIST_MAX_BODY_BYTES,
  executeAnilistProxyRequest,
  validateAnilistGetRequest,
  validateAnilistPostRequest,
} from './_lib/anilist.js';
import { ApiError, createApiHandler, readJsonBody } from './_lib/http.js';

export default createApiHandler(
  {
    allowedMethods: ['GET', 'POST'],
    timeoutMs: 9000,
    cacheControl: 'no-store',
  },
  async (req, res, ctx) => {
    // Reject any Authorization header: Phase 2B only proxies public, unauthenticated catalog queries.
    if (req.headers.authorization !== undefined) {
      throw new ApiError(
        400,
        'AUTH_NOT_SUPPORTED',
        'Authorization headers are not permitted on this public AniList endpoint.'
      );
    }

    let validated;

    if (ctx.method === 'GET') {
      validated = validateAnilistGetRequest(ctx.query);
    } else {
      const contentTypeHeader = req.headers['content-type'];
      const contentType = Array.isArray(contentTypeHeader)
        ? (contentTypeHeader[0] || '').toLowerCase()
        : (contentTypeHeader || '').toLowerCase();

      if (contentType && !contentType.includes('application/json')) {
        throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
      }

      const body = await readJsonBody<unknown>(req, {
        maxBytes: ANILIST_MAX_BODY_BYTES,
        required: true,
      });
      validated = validateAnilistPostRequest(body, ctx.query);
    }

    const result = await executeAnilistProxyRequest(validated, {
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
    res.setHeader('X-Miyoro-Anilist-Op', result.operation);
    res.setHeader('Content-Length', Buffer.byteLength(result.bodyText, 'utf8'));
    res.end(result.bodyText);
  }
);
