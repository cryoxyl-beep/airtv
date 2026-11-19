import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAllowedOrigins } from './env.js';

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface ApiRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export type ApiResponse = ServerResponse<IncomingMessage>;

export interface ApiHandlerContext {
  requestId: string;
  method: HttpMethod;
  url: URL;
  query: URLSearchParams;
  signal: AbortSignal;
}

export interface ApiHandlerOptions {
  allowedMethods: Exclude<HttpMethod, 'OPTIONS'>[];
  /**
   * Overall handler timeout in milliseconds.
   * Defaults to 9000ms to stay safely within Vercel Hobby serverless execution limits.
   */
  timeoutMs?: number;
  /**
   * Default Cache-Control header applied unless the handler explicitly overrides it.
   */
  cacheControl?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly expose: boolean;
  readonly retryAfterSeconds?: number;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: { expose?: boolean; cause?: unknown; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = options.expose ?? statusCode < 500;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const DEFAULT_HANDLER_TIMEOUT_MS = 9000;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 7500;
const DEFAULT_MAX_BODY_BYTES = 64 * 1024; // 64 KB
const MAX_URL_LENGTH = 2048;

function generateRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now().toString(36)}_${rand}`;
}

function getHeaderValue(req: ApiRequest, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return typeof raw === 'string' ? raw : undefined;
}

function getRequestHost(req: ApiRequest): string | null {
  const forwardedHost = getHeaderValue(req, 'x-forwarded-host');
  const host = (forwardedHost || getHeaderValue(req, 'host') || '').split(',')[0]?.trim();
  return host || null;
}

function getRequestProtocol(req: ApiRequest): 'http' | 'https' {
  const forwardedProto = getHeaderValue(req, 'x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwardedProto === 'http' || forwardedProto === 'https') {
    return forwardedProto;
  }
  const host = getRequestHost(req) || '';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return 'http';
  }
  return 'https';
}

function parseRequestUrl(req: ApiRequest): URL {
  const rawUrl = req.url || '/';
  if (rawUrl.length > MAX_URL_LENGTH) {
    throw new ApiError(414, 'URI_TOO_LONG', 'Request URL exceeds maximum allowed length.');
  }
  const host = getRequestHost(req) || 'localhost';
  const proto = getRequestProtocol(req);
  try {
    return new URL(rawUrl, `${proto}://${host}`);
  } catch {
    throw new ApiError(400, 'INVALID_URL', 'Malformed request URL.');
  }
}

function applySecurityHeaders(res: ApiResponse, cacheControl: string): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', cacheControl);
  }
}

function isOriginAllowed(req: ApiRequest, origin: string): boolean {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (parsedOrigin.protocol !== 'https:' && parsedOrigin.protocol !== 'http:') {
    return false;
  }

  // Same-origin check against request host (handles Miyoro's production & preview domains automatically)
  const requestHost = getRequestHost(req);
  if (requestHost && parsedOrigin.host.toLowerCase() === requestHost.toLowerCase()) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.has(parsedOrigin.origin);
}

function handleCors(
  req: ApiRequest,
  res: ApiResponse,
  allowedMethods: Exclude<HttpMethod, 'OPTIONS'>[]
): { preflightHandled: boolean } {
  const origin = getHeaderValue(req, 'origin')?.trim();
  const methodsHeader = [...allowedMethods, 'OPTIONS'].join(', ');

  // Always vary on Origin when responses could depend on Origin checks
  res.setHeader('Vary', 'Origin');

  if (origin) {
    if (!isOriginAllowed(req, origin)) {
      throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Cross-origin request is not permitted.');
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methodsHeader);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', methodsHeader);
    res.end();
    return { preflightHandled: true };
  }

  return { preflightHandled: false };
}

export function sendJson(res: ApiResponse, statusCode: number, payload: unknown): void {
  if (res.writableEnded || res.headersSent) return;
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'));
  res.end(body);
}

export function sendEmpty(res: ApiResponse, statusCode: number): void {
  if (res.writableEnded || res.headersSent) return;
  res.statusCode = statusCode;
  res.end();
}

export function sendError(res: ApiResponse, err: unknown, requestId: string): void {
  if (res.writableEnded || res.headersSent) return;

  // Never allow error responses to be cached by CDNs or browsers
  res.setHeader('Cache-Control', 'no-store');

  if (err instanceof ApiError) {
    if (err.retryAfterSeconds !== undefined && err.retryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(Math.ceil(err.retryAfterSeconds)));
    }
    const publicMessage = err.expose ? err.message : 'An internal server error occurred.';
    sendJson(res, err.statusCode, {
      ok: false,
      error: {
        code: err.code,
        message: publicMessage,
      },
      requestId,
    });
    return;
  }

  sendJson(res, 500, {
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    },
    requestId,
  });
}

/**
 * Safely parses a JSON request body with strict size limits.
 * Ready for Phase 2 POST routes (e.g. AniList GraphQL proxy).
 */
export async function readJsonBody<T = Record<string, unknown>>(
  req: ApiRequest,
  options: { maxBytes?: number; required?: boolean } = {}
): Promise<T> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES;

  // Vercel may pre-parse JSON bodies onto req.body
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > maxBytes) {
        throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds maximum allowed size.');
      }
      try {
        return JSON.parse(req.body) as T;
      } catch {
        throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
      }
    }
    if (req.body !== null && typeof req.body === 'object') {
      const serialized = JSON.stringify(req.body);
      if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
        throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds maximum allowed size.');
      }
      return req.body as T;
    }
  }

  const contentType = (getHeaderValue(req, 'content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds maximum allowed size.');
    }
    chunks.push(buf);
  }

  if (totalBytes === 0) {
    if (options.required) {
      throw new ApiError(400, 'EMPTY_BODY', 'Request body is required.');
    }
    return {} as T;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

/**
 * Helper for Phase 2 upstream API calls with abort-safe timeouts.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
  fetchFn: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init.signal;

  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    controller.abort(new ApiError(504, 'UPSTREAM_TIMEOUT', 'Upstream provider request timed out.'));
  }, timeoutMs);

  try {
    return await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      if (controller.signal.reason instanceof ApiError) {
        throw controller.signal.reason;
      }
      throw new ApiError(504, 'UPSTREAM_TIMEOUT', 'Upstream provider request timed out.');
    }
    throw new ApiError(502, 'UPSTREAM_FETCH_FAILED', 'Failed to reach upstream provider.', {
      cause: err,
    });
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/**
 * Wraps a Vercel serverless route with:
 * - Strict same-origin / allowlisted CORS handling
 * - Method validation
 * - Safe security headers
 * - Request timeout with AbortSignal propagation
 * - Guaranteed safe JSON error responses (no unhandled exceptions or stack leaks)
 */
export function createApiHandler(
  options: ApiHandlerOptions,
  handler: (req: ApiRequest, res: ApiResponse, ctx: ApiHandlerContext) => Promise<void> | void
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS;
  const cacheControl = options.cacheControl ?? 'no-store';
  const allowedMethodSet = new Set<string>(options.allowedMethods);

  return async function vercelApiHandler(req: ApiRequest, res: ApiResponse): Promise<void> {
    const requestId = generateRequestId();
    res.setHeader('X-Request-Id', requestId);
    applySecurityHeaders(res, cacheControl);

    const abortController = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
      const { preflightHandled } = handleCors(req, res, options.allowedMethods);
      if (preflightHandled) {
        return;
      }

      const method = (req.method || 'GET').toUpperCase() as HttpMethod;
      if (!allowedMethodSet.has(method)) {
        res.setHeader('Allow', [...options.allowedMethods, 'OPTIONS'].join(', '));
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${method} is not allowed on this endpoint.`);
      }

      const parsedUrl = parseRequestUrl(req);
      const ctx: ApiHandlerContext = {
        requestId,
        method,
        url: parsedUrl,
        query: parsedUrl.searchParams,
        signal: abortController.signal,
      };

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const timeoutErr = new ApiError(504, 'REQUEST_TIMEOUT', 'The request timed out.');
          abortController.abort(timeoutErr);
          reject(timeoutErr);
        }, timeoutMs);
      });

      await Promise.race([Promise.resolve(handler(req, res, ctx)), timeoutPromise]);

      // Ensure a response was always sent if handler resolved without writing
      if (!res.writableEnded && !res.headersSent) {
        sendEmpty(res, 204);
      }
    } catch (err: unknown) {
      if (!(err instanceof ApiError) || err.statusCode >= 500) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[miyoro-api] ${requestId} failed:`, message);
      }
      sendError(res, err, requestId);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  };
}
