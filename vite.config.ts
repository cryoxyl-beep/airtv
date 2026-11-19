import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {defineConfig, type Plugin} from 'vite';

function miyoroDevApiPlugin(): Plugin {
  const apiRoot = path.resolve(__dirname, 'api');
  const validSegment = /^[a-zA-Z0-9-]+$/;

  return {
    name: 'miyoro-dev-api',
    configureServer(server) {
      // Load local server-only env files into Node process.env for dev API routes (never exposed to browser)
      dotenv.config({path: path.resolve(__dirname, '.env')});
      dotenv.config({path: path.resolve(__dirname, '.env.local'), override: true});

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0] || '';
        if (pathname !== '/api' && !pathname.startsWith('/api/')) {
          return next();
        }

        let modulePath = '';

        if (pathname === '/api/tmdb' || pathname.startsWith('/api/tmdb/')) {
          modulePath = '/api/tmdb.ts';
        } else {
          const relPath = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
          const segments = relPath ? relPath.split('/') : [];

          // Reject empty paths, path traversal, or private _-prefixed helper modules
          if (
            segments.length === 0 ||
            segments.some((seg) => !validSegment.test(seg) || seg.startsWith('_'))
          ) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'API endpoint not found.',
                },
              })
            );
            return;
          }

          const candidateFile = path.resolve(apiRoot, ...segments) + '.ts';
          if (!candidateFile.startsWith(apiRoot + path.sep) || !fs.existsSync(candidateFile)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'API endpoint not found.',
                },
              })
            );
            return;
          }

          modulePath = `/api/${segments.join('/')}.ts`;
        }

        try {
          const mod = await server.ssrLoadModule(modulePath);
          if (typeof mod?.default !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'INVALID_HANDLER',
                  message: 'API endpoint handler is invalid.',
                },
              })
            );
            return;
          }
          await mod.default(req, res);
        } catch (err) {
          console.error('[miyoro-dev-api] Unhandled error loading route:', err);
          if (!res.writableEnded && !res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'An unexpected server error occurred.',
                },
              })
            );
          }
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), miyoroDevApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
