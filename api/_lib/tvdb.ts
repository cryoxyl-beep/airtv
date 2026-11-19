import { getTvdbApiKey } from './env.js';
import { ApiError, fetchWithTimeout } from './http.js';

export const TVDB_API_BASE_URL = 'https://api4.thetvdb.com/v4';

/**
 * Bounded overall request deadline for a single `/api/tvdb` invocation.
 * Kept strictly below `createApiHandler`'s 9000ms handler timeout (and Vercel Hobby's 10s cap)
 * so sequential auth + data fetch + possible single 401 refresh never exceed the handler budget.
 */
export const DEFAULT_OVERALL_BUDGET_MS = 8500;
const MAX_LOGIN_STEP_MS = 3000;
const MAX_DATA_STEP_MS = 5000;
const MIN_LOGIN_BUDGET_MS = 1000;
const MIN_DATA_FETCH_BUDGET_MS = 1200;

const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000; // Refresh JWT 5 minutes before exp
const FALLBACK_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // Conservative 12h fallback if exp missing
const MAX_MEMORY_CACHE_ENTRIES = 150;
const MAX_MEMORY_FRESH_TTL_MS = 30 * 1000;
const MAX_RATE_LIMIT_COOLDOWN_SECONDS = 60;
const DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 15;

export type TvdbOperationName = 'seriesEpisodes';
export type TvdbCacheCategory = 'episodes';
export type TvdbCacheStatus = 'MISS' | 'HIT' | 'STALE' | 'BYPASS';

export interface TvdbCachePolicy {
  category: TvdbCacheCategory;
  /** Vercel shared CDN fresh duration in seconds (`s-maxage`). */
  sMaxAgeSeconds: number;
  /** Vercel shared CDN stale-while-revalidate window in seconds. */
  staleWhileRevalidateSeconds: number;
  /**
   * Short per-instance burst absorption TTL in milliseconds.
   * NOTE: Per-instance memory is NOT globally shared across Vercel serverless instances.
   */
  instanceFreshTtlMs: number;
  /**
   * Maximum age in milliseconds a warm instance may serve a cached valid non-empty payload
   * as a stale fallback when TVDB fails transiently (429 / 5xx / timeout / network).
   */
  instanceStaleTtlMs: number;
}

export const TVDB_CACHE_POLICIES: Record<TvdbCacheCategory, TvdbCachePolicy> = {
  episodes: {
    category: 'episodes',
    sMaxAgeSeconds: 21600, // 6 hours
    staleWhileRevalidateSeconds: 43200, // 12 hours
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_MS,
    instanceStaleTtlMs: (21600 + 43200) * 1000, // 18 hours
  },
};

export function buildTvdbCacheControlHeader(
  policy: TvdbCachePolicy,
  options: { staleFallback?: boolean; emptyResult?: boolean } = {}
): string {
  // Never retain empty valid episode responses in long-lived CDN caches.
  if (options.emptyResult) {
    return 'no-store';
  }
  if (options.staleFallback) {
    return 'public, max-age=0, s-maxage=30, stale-while-revalidate=60';
  }
  return `public, max-age=0, s-maxage=${policy.sMaxAgeSeconds}, stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`;
}

export interface ValidatedTvdbRequest {
  operation: TvdbOperationName;
  seriesId: number;
  seasonType: 'default';
  lang: 'eng';
  page: number;
  upstreamUrl: string;
  canonicalQueryString: string;
  cacheKey: string;
  policy: TvdbCachePolicy;
}

const POSITIVE_INT_REGEX = /^[1-9]\d{0,9}$/;
const ALLOWED_PAGE_REGEX = /^[0-2]$/;
const ALLOWED_GET_PARAMS = new Set(['op', 'seriesId', 'page', 'seasonType', 'lang']);

/**
 * Builds a deterministic, alphabetically sorted GET query string for CDN cache-key consistency.
 */
export function buildCanonicalTvdbGetQuery(params: {
  operation: TvdbOperationName;
  seriesId: number;
  seasonType: 'default';
  lang: 'eng';
  page: number;
}): string {
  const entries: [string, string][] = [
    ['lang', params.lang],
    ['op', params.operation],
    ['page', String(params.page)],
    ['seasonType', params.seasonType],
    ['seriesId', String(params.seriesId)],
  ];
  entries.sort(([a], [b]) => a.localeCompare(b));
  const search = new URLSearchParams();
  for (const [k, v] of entries) {
    search.set(k, v);
  }
  return search.toString();
}

/**
 * Validates `GET /api/tvdb` query parameters strictly against Miyoro's TVDB allowlist.
 * Constructs upstream URL solely from server-owned constants + validated primitives
 * (zero path traversal or arbitrary URL forwarding).
 */
export function validateTvdbRequest(query: URLSearchParams): ValidatedTvdbRequest {
  const seenKeys = new Set<string>();

  for (const [key] of query.entries()) {
    if (!ALLOWED_GET_PARAMS.has(key)) {
      throw new ApiError(
        400,
        'INVALID_QUERY_PARAMETER',
        `Query parameter "${key}" is not supported on this endpoint.`
      );
    }
    if (seenKeys.has(key)) {
      throw new ApiError(
        400,
        'INVALID_QUERY_PARAMETER',
        `Duplicate query parameter "${key}" is not permitted.`
      );
    }
    seenKeys.add(key);
  }

  const rawOp = query.get('op')?.trim();
  if (!rawOp) {
    throw new ApiError(
      400,
      'MISSING_QUERY_PARAMETER',
      'Query parameter "op" is required for GET /api/tvdb requests.'
    );
  }
  if (rawOp !== 'seriesEpisodes') {
    throw new ApiError(
      400,
      'UNSUPPORTED_OPERATION',
      `TVDB operation "${rawOp}" is not supported.`
    );
  }

  const rawSeriesId = query.get('seriesId')?.trim();
  if (!rawSeriesId) {
    throw new ApiError(
      400,
      'MISSING_QUERY_PARAMETER',
      'Query parameter "seriesId" is required.'
    );
  }
  if (!POSITIVE_INT_REGEX.test(rawSeriesId)) {
    throw new ApiError(
      400,
      'INVALID_QUERY_PARAMETER',
      'Query parameter "seriesId" must be a positive integer.'
    );
  }
  const seriesId = Number.parseInt(rawSeriesId, 10);
  if (!Number.isSafeInteger(seriesId) || seriesId < 1 || seriesId > 2_147_483_647) {
    throw new ApiError(
      400,
      'INVALID_QUERY_PARAMETER',
      'Query parameter "seriesId" must be a valid positive integer.'
    );
  }

  const rawPage = query.get('page');
  let page = 0;
  if (rawPage !== null) {
    const trimmedPage = rawPage.trim();
    if (!ALLOWED_PAGE_REGEX.test(trimmedPage)) {
      throw new ApiError(
        400,
        'INVALID_QUERY_PARAMETER',
        'Query parameter "page" must be an integer between 0 and 2.'
      );
    }
    page = Number.parseInt(trimmedPage, 10);
  }

  const rawSeasonType = query.get('seasonType');
  let seasonType: 'default' = 'default';
  if (rawSeasonType !== null) {
    const trimmed = rawSeasonType.trim();
    if (trimmed !== 'default') {
      throw new ApiError(
        400,
        'INVALID_QUERY_PARAMETER',
        'Query parameter "seasonType" must be "default".'
      );
    }
    seasonType = 'default';
  }

  const rawLang = query.get('lang');
  let lang: 'eng' = 'eng';
  if (rawLang !== null) {
    const trimmed = rawLang.trim();
    if (trimmed !== 'eng') {
      throw new ApiError(
        400,
        'INVALID_QUERY_PARAMETER',
        'Query parameter "lang" must be "eng".'
      );
    }
    lang = 'eng';
  }

  const canonicalQueryString = buildCanonicalTvdbGetQuery({
    operation: 'seriesEpisodes',
    seriesId,
    seasonType,
    lang,
    page,
  });

  const upstreamUrl = `${TVDB_API_BASE_URL}/series/${seriesId}/episodes/${seasonType}/${lang}?page=${page}`;
  const cacheKey = `seriesEpisodes:seriesId=${seriesId}&seasonType=${seasonType}&lang=${lang}&page=${page}`;

  return {
    operation: 'seriesEpisodes',
    seriesId,
    seasonType,
    lang,
    page,
    upstreamUrl,
    canonicalQueryString,
    cacheKey,
    policy: TVDB_CACHE_POLICIES.episodes,
  };
}

// ---------------------------------------------------------------------------
// Server-Side TVDB v4 Authentication & Token Lifecycle (Per Warm Instance)
// ---------------------------------------------------------------------------

interface CachedTvdbToken {
  token: string;
  expiresAtMs: number;
}

interface InstanceCacheEntry {
  bodyText: string;
  storedAt: number;
  policy: TvdbCachePolicy;
  isEmpty: boolean;
}

export interface TvdbProxyResponse {
  statusCode: 200;
  bodyText: string;
  cacheControl: string;
  cachePolicy: TvdbCacheCategory;
  cacheStatus: TvdbCacheStatus;
  operation: TvdbOperationName;
}

export interface ExecuteTvdbProxyOptions {
  signal?: AbortSignal;
  /** Bounded overall request budget in milliseconds (defaults to 8500ms, strictly < 9000ms handler timeout). */
  overallBudgetMs?: number;
  fetchFn?: typeof fetch;
  getApiKey?: () => string | null;
  now?: () => number;
}

// Per-instance warm memory state (NOT globally shared across Vercel serverless instances).
let cachedToken: CachedTvdbToken | null = null;
let inFlightTokenPromise: Promise<CachedTvdbToken> | null = null;
const instanceCache = new Map<string, InstanceCacheEntry>();
const inFlightRequests = new Map<string, Promise<InstanceCacheEntry>>();
let rateLimitBlockedUntilMs = 0;

/** Resets per-instance token cache, episode cache, in-flight maps, and rate-limit cooldown (primarily for tests). */
export function resetTvdbProxyState(): void {
  cachedToken = null;
  inFlightTokenPromise = null;
  instanceCache.clear();
  inFlightRequests.clear();
  rateLimitBlockedUntilMs = 0;
}

/**
 * Extracts `exp` claim (Unix epoch seconds) from a TVDB v4 JWT payload without external dependencies.
 * Signature verification is unnecessary because tokens come directly over HTTPS from api4.thetvdb.com/v4/login.
 */
export function extractJwtExpiryMs(jwt: string, fallbackNowMs: number): number {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return fallbackNowMs + FALLBACK_TOKEN_TTL_MS;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(decoded) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    // Fall through to conservative fallback TTL
  }
  return fallbackNowMs + FALLBACK_TOKEN_TTL_MS;
}

function isTokenUsable(entry: CachedTvdbToken | null, currentTimeMs: number): entry is CachedTvdbToken {
  return Boolean(entry) && currentTimeMs + TOKEN_REFRESH_SKEW_MS < entry!.expiresAtMs;
}

function invalidateTokenIfMatches(failedToken: string): void {
  if (cachedToken && cachedToken.token === failedToken) {
    cachedToken = null;
  }
}

function getInstanceCacheEntry(cacheKey: string): InstanceCacheEntry | undefined {
  const existing = instanceCache.get(cacheKey);
  if (!existing) return undefined;
  instanceCache.delete(cacheKey);
  instanceCache.set(cacheKey, existing);
  return existing;
}

function setInstanceCacheEntry(cacheKey: string, entry: InstanceCacheEntry): void {
  if (instanceCache.has(cacheKey)) {
    instanceCache.delete(cacheKey);
  } else if (instanceCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = instanceCache.keys().next().value;
    if (oldestKey !== undefined) {
      instanceCache.delete(oldestKey);
    }
  }
  instanceCache.set(cacheKey, entry);
}

function parseRetryAfterSeconds(headerValue: string | null, currentTimeMs: number): number {
  if (!headerValue) return DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS;
  const trimmed = headerValue.trim();

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Math.min(Math.max(parsed, 1), MAX_RATE_LIMIT_COOLDOWN_SECONDS);
  }

  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const deltaSeconds = Math.ceil((parsedDate - currentTimeMs) / 1000);
    if (deltaSeconds > 0) {
      return Math.min(deltaSeconds, MAX_RATE_LIMIT_COOLDOWN_SECONDS);
    }
  }

  return DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS;
}

function isTransientStaleEligibleError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.code === 'TVDB_RATE_LIMITED' ||
    err.code === 'TVDB_UPSTREAM_ERROR' ||
    err.code === 'UPSTREAM_TIMEOUT' ||
    err.code === 'UPSTREAM_FETCH_FAILED'
  );
}

function awaitWithCallerSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  deadlineMs: number,
  now: () => number
): Promise<T> {
  const remainingMs = deadlineMs - now();
  if (remainingMs <= 0) {
    return Promise.reject(
      new ApiError(504, 'UPSTREAM_TIMEOUT', 'TVDB request exceeded overall time budget.')
    );
  }

  if (signal?.aborted) {
    const reason =
      signal.reason instanceof ApiError
        ? signal.reason
        : new ApiError(504, 'REQUEST_TIMEOUT', 'The request timed out.');
    return Promise.reject(reason);
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const reason =
        signal?.reason instanceof ApiError
          ? signal.reason
          : new ApiError(504, 'REQUEST_TIMEOUT', 'The request timed out.');
      reject(reason);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new ApiError(504, 'UPSTREAM_TIMEOUT', 'TVDB request exceeded overall time budget.'));
    }, remainingMs);

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      }
    );
  });
}

async function acquireTvdbToken(
  apiKey: string,
  options: {
    stepTimeoutMs: number;
    fetchFn: typeof fetch;
    now: () => number;
    forceRefresh?: boolean;
  }
): Promise<string> {
  const currentTimeMs = options.now();

  if (!options.forceRefresh && isTokenUsable(cachedToken, currentTimeMs)) {
    return cachedToken.token;
  }

  if (options.stepTimeoutMs < MIN_LOGIN_BUDGET_MS) {
    throw new ApiError(
      504,
      'UPSTREAM_TIMEOUT',
      'Insufficient remaining request budget to authenticate with TVDB.'
    );
  }

  if (!inFlightTokenPromise) {
    inFlightTokenPromise = (async (): Promise<CachedTvdbToken> => {
      const response = await fetchWithTimeout(
        `${TVDB_API_BASE_URL}/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ apikey: apiKey }),
        },
        options.stepTimeoutMs,
        options.fetchFn
      );

      const postLoginTimeMs = options.now();

      if (response.status === 401 || response.status === 403) {
        cachedToken = null;
        instanceCache.clear();
        throw new ApiError(502, 'TVDB_AUTH_ERROR', 'Upstream TVDB authentication failed.', {
          expose: true,
        });
      }

      if (response.status === 429) {
        const retryAfterSeconds = parseRetryAfterSeconds(
          response.headers.get('retry-after'),
          postLoginTimeMs
        );
        rateLimitBlockedUntilMs = postLoginTimeMs + retryAfterSeconds * 1000;
        throw new ApiError(
          429,
          'TVDB_RATE_LIMITED',
          'TVDB rate limit exceeded. Please try again shortly.',
          {
            expose: true,
            retryAfterSeconds,
          }
        );
      }

      if (response.status >= 500 || !response.ok) {
        throw new ApiError(
          502,
          'TVDB_UPSTREAM_ERROR',
          'TVDB authentication service is temporarily unavailable.',
          { expose: true }
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(await response.text());
      } catch {
        throw new ApiError(
          502,
          'TVDB_INVALID_RESPONSE',
          'TVDB authentication returned an invalid JSON payload.',
          { expose: true }
        );
      }

      const token =
        parsed &&
        typeof parsed === 'object' &&
        (parsed as { data?: { token?: unknown } }).data &&
        typeof (parsed as { data: { token?: unknown } }).data.token === 'string'
          ? (parsed as { data: { token: string } }).data.token.trim()
          : '';

      if (!token) {
        throw new ApiError(
          502,
          'TVDB_AUTH_ERROR',
          'TVDB authentication response did not include a valid token.',
          { expose: true }
        );
      }

      const expiresAtMs = extractJwtExpiryMs(token, postLoginTimeMs);
      const tokenEntry: CachedTvdbToken = { token, expiresAtMs };
      cachedToken = tokenEntry;
      return tokenEntry;
    })().finally(() => {
      inFlightTokenPromise = null;
    });
  }

  const resolved = await inFlightTokenPromise;
  return resolved.token;
}

async function fetchTvdbEpisodesOnce(
  validated: ValidatedTvdbRequest,
  token: string,
  stepTimeoutMs: number,
  fetchFn: typeof fetch
): Promise<Response> {
  if (stepTimeoutMs < MIN_DATA_FETCH_BUDGET_MS) {
    throw new ApiError(
      504,
      'UPSTREAM_TIMEOUT',
      'Insufficient remaining request budget to fetch TVDB episodes.'
    );
  }

  return fetchWithTimeout(
    validated.upstreamUrl,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    stepTimeoutMs,
    fetchFn
  );
}

async function fetchUpstreamTvdb(
  validated: ValidatedTvdbRequest,
  apiKey: string,
  options: {
    deadlineMs: number;
    fetchFn: typeof fetch;
    now: () => number;
  }
): Promise<InstanceCacheEntry> {
  const computeRemaining = () => options.deadlineMs - options.now();

  // Step 1: Ensure we have a valid server-side TVDB JWT within remaining budget.
  // Reserve MIN_DATA_FETCH_BUDGET_MS if we need to perform a login call so login cannot starve data fetch.
  const needsLogin = !isTokenUsable(cachedToken, options.now());
  const loginBudget = needsLogin
    ? Math.min(MAX_LOGIN_STEP_MS, computeRemaining() - MIN_DATA_FETCH_BUDGET_MS)
    : MAX_LOGIN_STEP_MS;

  let activeToken = await acquireTvdbToken(apiKey, {
    stepTimeoutMs: loginBudget,
    fetchFn: options.fetchFn,
    now: options.now,
    forceRefresh: false,
  });

  // Step 2: Execute upstream GET bounded strictly by remaining overall deadline.
  const firstDataBudget = Math.min(MAX_DATA_STEP_MS, computeRemaining());
  let response = await fetchTvdbEpisodesOnce(
    validated,
    activeToken,
    firstDataBudget,
    options.fetchFn
  );

  // Step 3: Single bounded 401 refresh + retry if token expired/revoked and sufficient deadline remains.
  if (response.status === 401) {
    invalidateTokenIfMatches(activeToken);
    const remainingBeforeRetry = computeRemaining();

    if (remainingBeforeRetry < MIN_LOGIN_BUDGET_MS + MIN_DATA_FETCH_BUDGET_MS) {
      // Insufficient remaining deadline to safely re-authenticate + retry; fail fast so frontend fallback runs.
      throw new ApiError(
        504,
        'UPSTREAM_TIMEOUT',
        'TVDB token refresh skipped due to insufficient remaining request budget.'
      );
    }

    const refreshBudget = Math.min(
      MAX_LOGIN_STEP_MS,
      remainingBeforeRetry - MIN_DATA_FETCH_BUDGET_MS
    );

    activeToken = await acquireTvdbToken(apiKey, {
      stepTimeoutMs: refreshBudget,
      fetchFn: options.fetchFn,
      now: options.now,
      forceRefresh: true,
    });

    const retryDataBudget = Math.min(MAX_DATA_STEP_MS, computeRemaining());
    response = await fetchTvdbEpisodesOnce(
      validated,
      activeToken,
      retryDataBudget,
      options.fetchFn
    );
  }

  const currentTimeMs = options.now();

  if (response.status === 401 || response.status === 403) {
    invalidateTokenIfMatches(activeToken);
    instanceCache.clear();
    throw new ApiError(502, 'TVDB_AUTH_ERROR', 'Upstream TVDB authentication failed.', {
      expose: true,
    });
  }

  if (response.status === 404) {
    instanceCache.delete(validated.cacheKey);
    throw new ApiError(404, 'TVDB_NOT_FOUND', 'The requested TVDB series or page was not found.', {
      expose: true,
    });
  }

  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfterSeconds(
      response.headers.get('retry-after'),
      currentTimeMs
    );
    rateLimitBlockedUntilMs = currentTimeMs + retryAfterSeconds * 1000;
    throw new ApiError(
      429,
      'TVDB_RATE_LIMITED',
      'TVDB rate limit exceeded. Please try again shortly.',
      {
        expose: true,
        retryAfterSeconds,
      }
    );
  }

  if (response.status >= 400 && response.status < 500) {
    throw new ApiError(
      400,
      'TVDB_REQUEST_REJECTED',
      `TVDB rejected the request with status ${response.status}.`,
      { expose: true }
    );
  }

  if (response.status >= 500 || !response.ok) {
    throw new ApiError(
      502,
      'TVDB_UPSTREAM_ERROR',
      'TVDB upstream service is temporarily unavailable.',
      { expose: true }
    );
  }

  const rawBody = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ApiError(502, 'TVDB_INVALID_RESPONSE', 'TVDB returned an invalid JSON payload.', {
      expose: true,
    });
  }

  // Validate TVDB v4 envelope shape: { data: { episodes: [...] } }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !(parsed as { data?: unknown }).data ||
    typeof (parsed as { data?: unknown }).data !== 'object' ||
    Array.isArray((parsed as { data?: unknown }).data) ||
    !Array.isArray((parsed as { data: { episodes?: unknown } }).data.episodes)
  ) {
    throw new ApiError(
      502,
      'TVDB_INVALID_RESPONSE',
      'TVDB returned an unexpected episode payload structure.',
      { expose: true }
    );
  }

  const episodes = (parsed as { data: { episodes: unknown[] } }).data.episodes;
  const isEmpty = episodes.length === 0;

  const entry: InstanceCacheEntry = {
    bodyText: rawBody,
    storedAt: currentTimeMs,
    policy: validated.policy,
    isEmpty,
  };

  // Never retain empty valid episode responses in warm instance cache or long-lived CDN caches.
  if (!isEmpty) {
    setInstanceCacheEntry(validated.cacheKey, entry);
  }

  return entry;
}

/**
 * Executes a validated TVDB proxy request using server-only `TVDB_API_KEY`,
 * bounded overall request deadline (covering login + fetch + optional single 401 refresh),
 * per-instance warm memory caching, in-flight deduplication, 429 cooldown protection,
 * and safe stale fallback on transient failures.
 */
export async function executeTvdbProxyRequest(
  validated: ValidatedTvdbRequest,
  options: ExecuteTvdbProxyOptions = {}
): Promise<TvdbProxyResponse> {
  const now = options.now ?? Date.now;
  const fetchFn = options.fetchFn ?? fetch;
  const overallBudgetMs = options.overallBudgetMs ?? DEFAULT_OVERALL_BUDGET_MS;
  const apiKey = (options.getApiKey ?? (() => getTvdbApiKey()))();

  if (!apiKey) {
    throw new ApiError(
      503,
      'TVDB_NOT_CONFIGURED',
      'TVDB API credentials are not configured on the server.',
      { expose: true }
    );
  }

  const startTimeMs = now();
  const deadlineMs = startTimeMs + overallBudgetMs;
  const cached = getInstanceCacheEntry(validated.cacheKey);

  // Serve from short per-instance burst cache if still fresh (non-empty entries only)
  if (cached && !cached.isEmpty && startTimeMs - cached.storedAt < validated.policy.instanceFreshTtlMs) {
    return {
      statusCode: 200,
      bodyText: cached.bodyText,
      cacheControl: buildTvdbCacheControlHeader(validated.policy),
      cachePolicy: validated.policy.category,
      cacheStatus: 'HIT',
      operation: validated.operation,
    };
  }

  const canServeStale =
    Boolean(cached) &&
    !cached!.isEmpty &&
    startTimeMs - cached!.storedAt <= validated.policy.instanceStaleTtlMs;

  // Respect upstream 429 cooldown before calling TVDB again
  if (rateLimitBlockedUntilMs > startTimeMs) {
    if (canServeStale && cached) {
      return {
        statusCode: 200,
        bodyText: cached.bodyText,
        cacheControl: buildTvdbCacheControlHeader(validated.policy, { staleFallback: true }),
        cachePolicy: validated.policy.category,
        cacheStatus: 'STALE',
        operation: validated.operation,
      };
    }

    const remainingSeconds = Math.max(1, Math.ceil((rateLimitBlockedUntilMs - startTimeMs) / 1000));
    throw new ApiError(
      429,
      'TVDB_RATE_LIMITED',
      'TVDB rate limit exceeded. Please try again shortly.',
      {
        expose: true,
        retryAfterSeconds: remainingSeconds,
      }
    );
  }

  // Deduplicate concurrent identical upstream requests within the same warm instance
  let sharedPromise = inFlightRequests.get(validated.cacheKey);
  if (!sharedPromise) {
    sharedPromise = fetchUpstreamTvdb(validated, apiKey, {
      deadlineMs,
      fetchFn,
      now,
    }).finally(() => {
      inFlightRequests.delete(validated.cacheKey);
    });
    inFlightRequests.set(validated.cacheKey, sharedPromise);
  }

  try {
    const entry = await awaitWithCallerSignal(sharedPromise, options.signal, deadlineMs, now);
    return {
      statusCode: 200,
      bodyText: entry.bodyText,
      cacheControl: buildTvdbCacheControlHeader(validated.policy, { emptyResult: entry.isEmpty }),
      cachePolicy: validated.policy.category,
      cacheStatus: entry.isEmpty ? 'BYPASS' : 'MISS',
      operation: validated.operation,
    };
  } catch (err: unknown) {
    // Only fall back to previously valid cached non-empty payload on transient failures.
    // Never mask 401/403 auth errors, 404 not found, 400 rejections, or invalid responses.
    if (canServeStale && cached && isTransientStaleEligibleError(err)) {
      return {
        statusCode: 200,
        bodyText: cached.bodyText,
        cacheControl: buildTvdbCacheControlHeader(validated.policy, { staleFallback: true }),
        cachePolicy: validated.policy.category,
        cacheStatus: 'STALE',
        operation: validated.operation,
      };
    }
    throw err;
  }
}
