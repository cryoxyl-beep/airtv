import { getServerEnvSummary } from './_lib/env.js';
import { createApiHandler, sendEmpty, sendJson } from './_lib/http.js';

export default createApiHandler(
  {
    allowedMethods: ['GET', 'HEAD'],
    timeoutMs: 5000,
    cacheControl: 'no-store',
  },
  async (_req, res, ctx) => {
    if (ctx.method === 'HEAD') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      sendEmpty(res, 200);
      return;
    }

    const envSummary = getServerEnvSummary();

    sendJson(res, 200, {
      ok: true,
      status: 'healthy',
      service: 'miyoro-api',
      message: 'Miyoro API backend is running.',
      timestamp: new Date().toISOString(),
      providers: {
        tmdb: {
          configured: envSummary.tmdbConfigured,
        },
        tvdb: {
          configured: envSummary.tvdbConfigured,
        },
        anilist: {
          configured: true,
          usingDefaultEndpoint: envSummary.anilistUsingDefault,
        },
      },
    });
  }
);
