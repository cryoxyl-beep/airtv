import { getTmdbApiToken } from './env.js';
import { ApiError, fetchWithTimeout } from './http.js';

export const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_INTERNAL_PATH_PARAM = 'tmdbPath';

const DEFAULT_UPSTREAM_TIMEOUT_MS = 7000;
const MAX_PATH_LENGTH = 200;
const MAX_QUERY_VALUE_LENGTH = 200;
const MAX_MEMORY_CACHE_ENTRIES = 150;
const MAX_MEMORY_FRESH_TTL_SECONDS = 30;
const MAX_RATE_LIMIT_COOLDOWN_SECONDS = 60;
const DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 10;

export type TmdbCacheCategory =
  | 'trending'
  | 'popular'
  | 'discover'
  | 'search'
  | 'details'
  | 'credits'
  | 'genres'
  | 'providers';

export interface TmdbCachePolicy {
  category: TmdbCacheCategory;
  /** Vercel shared CDN fresh duration in seconds (`s-maxage`). */
  sMaxAgeSeconds: number;
  /** Vercel shared CDN stale-while-revalidate window in seconds. */
  staleWhileRevalidateSeconds: number;
  /**
   * Short per-instance burst absorption TTL in milliseconds.
   * Kept intentionally brief (<= 30s) so Vercel CDN revalidations always hit TMDB fresh.
   * NOTE: Per-instance memory is NEVER globally shared across serverless instances.
   */
  instanceFreshTtlMs: number;
  /**
   * Maximum age in milliseconds a warm instance may serve a cached successful payload
   * as a stale fallback when TMDB fails transiently (429 / 5xx / timeout).
   */
  instanceStaleTtlMs: number;
}

export const TMDB_CACHE_POLICIES: Record<TmdbCacheCategory, TmdbCachePolicy> = {
  trending: {
    category: 'trending',
    sMaxAgeSeconds: 900, // 15 minutes
    staleWhileRevalidateSeconds: 1800, // 30 minutes
    instanceFreshTtlMs: Math.min(900, MAX_MEMORY_FRESH_TTL_SECONDS) * 1000,
    instanceStaleTtlMs: (900 + 1800) * 1000,
  },
  popular: {
    category: 'popular',
    sMaxAgeSeconds: 1800, // 30 minutes
    staleWhileRevalidateSeconds: 3600, // 60 minutes
    instanceFreshTtlMs: Math.min(1800, MAX_MEMORY_FRESH_TTL_SECONDS) * 1000,
    instanceStaleTtlMs: (1800 + 3600) * 1000,
  },
  discover: {
    category: 'discover',
    sMaxAgeSeconds: 1800, // 30 minutes
    staleWhileRevalidateSeconds: 3600, // 60 minutes
    instanceFreshTtlMs: Math.min(1800, MAX_MEMORY_FRESH_TTL_SECONDS) * 1000,
    instanceStaleTtlMs: (1800 + 3600) * 1000,
  },
  search: {
    category: 'search',
    sMaxAgeSeconds: 120, // 2 minutes
    staleWhileRevalidateSeconds: 300, // 5 minutes
    instanceFreshTtlMs: Math.min(120, MAX_MEMORY_FRESH_TTL_SECONDS) * 1000,
    instanceStaleTtlMs: (120 + 300) * 1000,
  },
  details: {
    category: 'details',
    sMaxAgeSeconds: 86400, // 24 hours
    staleWhileRevalidateSeconds: 86400, // 24 hours
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (86400 + 86400) * 1000,
  },
  credits: {
    category: 'credits',
    sMaxAgeSeconds: 86400, // 24 hours
    staleWhileRevalidateSeconds: 86400, // 24 hours
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (86400 + 86400) * 1000,
  },
  genres: {
    category: 'genres',
    sMaxAgeSeconds: 86400, // 24 hours
    staleWhileRevalidateSeconds: 86400, // 24 hours
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (86400 + 86400) * 1000,
  },
  providers: {
    category: 'providers',
    sMaxAgeSeconds: 86400, // 24 hours
    staleWhileRevalidateSeconds: 86400, // 24 hours
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (86400 + 86400) * 1000,
  },
};

export function buildCacheControlHeader(
  policy: TmdbCachePolicy,
  options: { staleFallback?: boolean } = {}
): string {
  if (options.staleFallback) {
    // Short CDN cache for stale fallback so edge revalidates promptly once TMDB recovers
    return 'public, max-age=0, s-maxage=30, stale-while-revalidate=60';
  }
  return `public, max-age=0, s-maxage=${policy.sMaxAgeSeconds}, stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`;
}

interface AllowedRouteRule {
  name: string;
  pattern: RegExp;
  cacheCategory: TmdbCacheCategory;
  allowedParams: readonly string[];
  requiredParams?: readonly string[];
}

const DISCOVER_ALLOWED_PARAMS = [
  'include_adult',
  'include_null_first_air_dates',
  'language',
  'page',
  'sort_by',
  'with_genres',
  'without_genres',
  'origin_country',
  'with_origin_country',
  'with_original_language',
  'watch_region',
  'with_watch_providers',
  'with_watch_monetization_types',
  'vote_count.gte',
  'vote_average.gte',
  'primary_release_year',
  'first_air_date_year',
] as const;

const SEARCH_ALLOWED_PARAMS = [
  'query',
  'include_adult',
  'language',
  'page',
  'region',
  'year',
  'primary_release_year',
  'first_air_date_year',
] as const;

const DETAILS_ALLOWED_PARAMS = [
  'language',
  'append_to_response',
  'include_image_language',
  'include_video_language',
] as const;

/**
 * Strict allowlist of public, read-only TMDB v3 endpoints used by Miyoro.
 * No account, authentication, write, or arbitrary wildcard endpoints are permitted.
 */
const ALLOWED_TMDB_ROUTES: readonly AllowedRouteRule[] = [
  {
    name: 'trending',
    pattern: /^trending\/(all|movie|tv|person)\/(day|week)$/,
    cacheCategory: 'trending',
    allowedParams: ['language', 'page'],
  },
  {
    name: 'catalog-list',
    pattern: /^(movie|tv)\/(popular|top_rated)$/,
    cacheCategory: 'popular',
    allowedParams: ['language', 'page', 'region'],
  },
  {
    name: 'discover',
    pattern: /^discover\/(movie|tv)$/,
    cacheCategory: 'discover',
    allowedParams: DISCOVER_ALLOWED_PARAMS,
  },
  {
    name: 'search',
    pattern: /^search\/(movie|tv|multi|person)$/,
    cacheCategory: 'search',
    allowedParams: SEARCH_ALLOWED_PARAMS,
    requiredParams: ['query'],
  },
  {
    name: 'media-details',
    pattern: /^(movie|tv)\/([1-9]\d{0,9})$/,
    cacheCategory: 'details',
    allowedParams: DETAILS_ALLOWED_PARAMS,
  },
  {
    name: 'media-assets',
    pattern: /^(movie|tv)\/([1-9]\d{0,9})\/(images|videos)$/,
    cacheCategory: 'details',
    allowedParams: ['language', 'include_image_language', 'include_video_language'],
  },
  {
    name: 'tv-season',
    pattern: /^tv\/([1-9]\d{0,9})\/season\/(0|[1-9]\d{0,3})$/,
    cacheCategory: 'details',
    allowedParams: ['language', 'append_to_response'],
  },
  {
    name: 'person-details',
    pattern: /^person\/([1-9]\d{0,9})$/,
    cacheCategory: 'details',
    allowedParams: ['language', 'append_to_response'],
  },
  {
    name: 'person-combined-credits',
    pattern: /^person\/([1-9]\d{0,9})\/combined_credits$/,
    cacheCategory: 'credits',
    allowedParams: ['language'],
  },
  {
    name: 'genre-list',
    pattern: /^genre\/(movie|tv)\/list$/,
    cacheCategory: 'genres',
    allowedParams: ['language'],
  },
  {
    name: 'watch-providers',
    pattern: /^watch\/providers\/(movie|tv)$/,
    cacheCategory: 'providers',
    allowedParams: ['language', 'watch_region'],
  },
];

const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/;
const LANGUAGE_REGEX = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const COUNTRY_LIST_REGEX = /^[A-Z]{2}(?:[|,][A-Z]{2})*$/;
const ISO_LANG_2_REGEX = /^[a-z]{2}$/;
const SORT_BY_REGEX = /^[a-z0-9_]+\.(asc|desc)$/;
const NUMERIC_ID_LIST_REGEX = /^[0-9]+(?:[|,][0-9]+)*$/;
const MONETIZATION_REGEX = /^(flatrate|free|ads|rent|buy)(?:[|,](flatrate|free|ads|rent|buy))*$/;
const YEAR_REGEX = /^(18|19|20|21)\d{2}$/;
const IMAGE_VIDEO_LANG_REGEX = /^(?:[a-z]{2}(?:-[A-Z]{2})?|null)(?:,(?:[a-z]{2}(?:-[A-Z]{2})?|null))*$/;
const APPEND_TOKEN_REGEX =
  /^(images|credits|content_ratings|release_dates|videos|external_ids|recommendations|similar|keywords|combined_credits|watch\/providers|season\/(0|[1-9]\d{0,3}))$/;

function validateQueryParamValue(key: string, rawValue: string): string {
  if (rawValue.length > MAX_QUERY_VALUE_LENGTH || CONTROL_CHAR_REGEX.test(rawValue)) {
    throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Invalid value for query parameter "${key}".`);
  }

  const trimmed = rawValue.trim();

  switch (key) {
    case 'language': {
      if (!LANGUAGE_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "language" must be a valid locale (e.g. en-US).');
      }
      return trimmed;
    }
    case 'page': {
      if (!/^[1-9]\d{0,2}$/.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "page" must be an integer between 1 and 500.');
      }
      const pageNum = Number.parseInt(trimmed, 10);
      if (pageNum < 1 || pageNum > 500) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "page" must be an integer between 1 and 500.');
      }
      return String(pageNum);
    }
    case 'include_adult':
    case 'include_null_first_air_dates': {
      if (trimmed !== 'true' && trimmed !== 'false') {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Query parameter "${key}" must be "true" or "false".`);
      }
      return trimmed;
    }
    case 'region':
    case 'watch_region':
    case 'origin_country':
    case 'with_origin_country': {
      if (!COUNTRY_LIST_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Query parameter "${key}" must contain valid ISO 3166-1 alpha-2 country codes.`);
      }
      return trimmed;
    }
    case 'with_original_language': {
      if (!ISO_LANG_2_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "with_original_language" must be a 2-letter ISO 639-1 language code.');
      }
      return trimmed;
    }
    case 'sort_by': {
      if (!SORT_BY_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "sort_by" has an invalid format.');
      }
      return trimmed;
    }
    case 'with_genres':
    case 'without_genres':
    case 'with_watch_providers': {
      if (!NUMERIC_ID_LIST_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Query parameter "${key}" must contain numeric IDs separated by "," or "|".`);
      }
      return trimmed;
    }
    case 'with_watch_monetization_types': {
      if (!MONETIZATION_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "with_watch_monetization_types" contains unsupported values.');
      }
      return trimmed;
    }
    case 'vote_count.gte': {
      if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "vote_count.gte" must be a non-negative number.');
      }
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num < 0 || num > 1_000_000) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "vote_count.gte" is out of range.');
      }
      return trimmed;
    }
    case 'vote_average.gte': {
      if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "vote_average.gte" must be a number between 0 and 10.');
      }
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num < 0 || num > 10) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "vote_average.gte" must be between 0 and 10.');
      }
      return trimmed;
    }
    case 'year':
    case 'primary_release_year':
    case 'first_air_date_year': {
      if (!YEAR_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Query parameter "${key}" must be a valid 4-digit year.`);
      }
      return trimmed;
    }
    case 'query': {
      if (!trimmed) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "query" must be a non-empty search term.');
      }
      return trimmed;
    }
    case 'append_to_response': {
      const rawTokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
      const uniqueTokens = Array.from(new Set(rawTokens));
      if (uniqueTokens.length === 0 || uniqueTokens.length > 10) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Query parameter "append_to_response" must contain between 1 and 10 valid sub-resources.');
      }
      for (const token of uniqueTokens) {
        if (!APPEND_TOKEN_REGEX.test(token)) {
          throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Unsupported "append_to_response" token: "${token}".`);
        }
      }
      // Sort canonically so equivalent append_to_response lists share identical upstream URLs and cache keys
      uniqueTokens.sort((a, b) => a.localeCompare(b));
      return uniqueTokens.join(',');
    }
    case 'include_image_language':
    case 'include_video_language': {
      if (!IMAGE_VIDEO_LANG_REGEX.test(trimmed)) {
        throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Invalid value for query parameter "${key}".`);
      }
      return trimmed;
    }
    default: {
      throw new ApiError(400, 'INVALID_QUERY_PARAMETER', `Unsupported query parameter "${key}".`);
    }
  }
}

export interface ValidatedTmdbRequest {
  normalizedPath: string;
  canonicalQueryString: string;
  upstreamUrl: string;
  cacheKey: string;
  policy: TmdbCachePolicy;
  routeName: string;
}

/**
 * Resolves the internal Vercel rewrite parameter (`tmdbPath`) safely.
 * Vercel rewrites (`source: "/api/tmdb/:tmdbPath*"` -> `destination: "/api/tmdb?tmdbPath=:tmdbPath*"`)
 * may supply a single slash-joined value, identical duplicate values (destination + auto-forwarded source param),
 * or the slash-joined value alongside split catch-all segments. Any conflicting values are rejected.
 */
function resolveInternalRewritePath(rawValues: string[]): string | null {
  if (rawValues.length === 0) return null;

  const normalized = rawValues.map((v) => (v.endsWith('/') && v.length > 1 ? v.slice(0, -1) : v));

  if (normalized.length === 1) {
    return normalized[0];
  }

  const unique = new Set(normalized);
  if (unique.size === 1) {
    return normalized[0];
  }

  const first = normalized[0];
  if (first && first === normalized.slice(1).join('/')) {
    return first;
  }

  const last = normalized[normalized.length - 1];
  if (last && last === normalized.slice(0, -1).join('/')) {
    return last;
  }

  throw new ApiError(400, 'INVALID_TMDB_PATH', 'Conflicting TMDB request paths.');
}

/**
 * Checks whether a `path` query parameter injected by a routing layer is an exact,
 * non-malicious echo of the already-validated TMDB subpath.
 * Any arbitrary, mismatched, empty, polluted, or traversal `path` value returns false
 * so normal strict query validation rejects it with 400 INVALID_QUERY_PARAMETER.
 */
function isExactInternalPathEcho(rawValues: string[], normalizedPath: string): boolean {
  if (rawValues.length === 0) return false;

  const cleaned = rawValues.map((v) => v.replace(/^\/+|\/+$/g, ''));

  if (
    cleaned.some(
      (v) =>
        !v ||
        v.includes('..') ||
        v.includes('\\') ||
        v.includes('%') ||
        CONTROL_CHAR_REGEX.test(v)
    )
  ) {
    return false;
  }

  if (cleaned.every((v) => v === normalizedPath)) {
    return true;
  }

  if (cleaned.join('/') === normalizedPath) {
    return true;
  }

  if (cleaned.length > 1) {
    if (cleaned[0] === normalizedPath && cleaned.slice(1).join('/') === normalizedPath) {
      return true;
    }
    if (
      cleaned[cleaned.length - 1] === normalizedPath &&
      cleaned.slice(0, -1).join('/') === normalizedPath
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes and validates the raw TMDB subpath from either `/api/tmdb/<subpath>`
 * or Vercel's rewrite query parameter `?tmdbPath=<subpath>`.
 */
export function extractAndNormalizeTmdbPath(
  pathname: string,
  query: URLSearchParams,
  rawRequestUrl?: string
): string {
  if (rawRequestUrl) {
    const rawPathname = rawRequestUrl.split(/[?#]/, 1)[0] || '';
    if (
      rawPathname.includes('..') ||
      rawPathname.includes('\\') ||
      rawPathname.includes('//') ||
      /%2e|%2f|%5c|%00/i.test(rawPathname) ||
      CONTROL_CHAR_REGEX.test(rawPathname)
    ) {
      throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed TMDB request path.');
    }
  }

  const internalPathParams = query.getAll(TMDB_INTERNAL_PATH_PARAM);
  const resolvedInternalPath = resolveInternalRewritePath(internalPathParams);

  let rawSubpath = '';
  let alreadyDecoded = false;

  if (pathname.startsWith('/api/tmdb/')) {
    rawSubpath = pathname.slice('/api/tmdb/'.length);
    // Reject encoded slash/backslash/null/dot-segment smuggling before decoding
    if (/%2f|%5c|%00|%2e/i.test(rawSubpath)) {
      throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed TMDB request path.');
    }
  } else if (pathname === '/api/tmdb') {
    if (resolvedInternalPath !== null) {
      rawSubpath = resolvedInternalPath;
      alreadyDecoded = true;
    }
  } else {
    throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed TMDB request path.');
  }

  // If both pathname subpath and rewrite param exist, they must match if non-empty
  if (pathname.startsWith('/api/tmdb/') && resolvedInternalPath !== null) {
    const cleanedRewrite = resolvedInternalPath.replace(/^\/+|\/+$/g, '');
    const cleanedPath = rawSubpath.replace(/^\/+|\/+$/g, '');
    if (cleanedRewrite && cleanedRewrite !== cleanedPath) {
      throw new ApiError(400, 'INVALID_TMDB_PATH', 'Conflicting TMDB request paths.');
    }
  }

  if (!rawSubpath || rawSubpath.length > MAX_PATH_LENGTH) {
    throw new ApiError(400, 'INVALID_TMDB_PATH', 'A valid TMDB endpoint path is required.');
  }

  if (
    CONTROL_CHAR_REGEX.test(rawSubpath) ||
    rawSubpath.includes('\\') ||
    rawSubpath.includes('?') ||
    rawSubpath.includes('#') ||
    rawSubpath.includes('..') ||
    rawSubpath.includes('://') ||
    rawSubpath.startsWith('//')
  ) {
    throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed TMDB request path.');
  }

  // Strip a single optional trailing slash, but reject empty internal segments (e.g. movie//550)
  const trimmedTrailing = rawSubpath.endsWith('/') ? rawSubpath.slice(0, -1) : rawSubpath;
  if (!trimmedTrailing || trimmedTrailing.startsWith('/')) {
    throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed TMDB request path.');
  }

  const rawSegments = trimmedTrailing.split('/');
  const normalizedSegments: string[] = [];

  for (const segment of rawSegments) {
    if (!segment) {
      throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed TMDB request path.');
    }

    let decoded = segment;
    if (!alreadyDecoded) {
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed URL encoding in TMDB request path.');
      }
    }

    if (
      !decoded ||
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('%') ||
      CONTROL_CHAR_REGEX.test(decoded) ||
      !/^[a-zA-Z0-9_-]+$/.test(decoded)
    ) {
      throw new ApiError(400, 'INVALID_TMDB_PATH', 'Malformed TMDB request path.');
    }

    normalizedSegments.push(decoded);
  }

  return normalizedSegments.join('/');
}

/**
 * Validates path and query parameters against Miyoro's strict TMDB allowlist
 * and constructs a canonical upstream URL + deterministic cache key.
 */
export function validateTmdbRequest(
  pathname: string,
  query: URLSearchParams,
  rawRequestUrl?: string
): ValidatedTmdbRequest {
  const normalizedPath = extractAndNormalizeTmdbPath(pathname, query, rawRequestUrl);

  const matchedRule = ALLOWED_TMDB_ROUTES.find((rule) => rule.pattern.test(normalizedPath));
  if (!matchedRule) {
    throw new ApiError(
      404,
      'UNSUPPORTED_ENDPOINT',
      'This TMDB endpoint is not supported by the Miyoro API proxy.'
    );
  }

  const allowedParamSet = new Set<string>(matchedRule.allowedParams);
  const validatedEntries: [string, string][] = [];
  const seenKeys = new Set<string>();
  const pathEchoMatchesRoute = isExactInternalPathEcho(query.getAll('path'), normalizedPath);

  for (const [key, value] of query.entries()) {
    if (key === TMDB_INTERNAL_PATH_PARAM) {
      continue;
    }
    if (key === 'path' && pathEchoMatchesRoute) {
      continue;
    }
    if (!allowedParamSet.has(key)) {
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
    validatedEntries.push([key, validateQueryParamValue(key, value)]);
  }

  if (matchedRule.requiredParams) {
    for (const requiredKey of matchedRule.requiredParams) {
      if (!seenKeys.has(requiredKey)) {
        throw new ApiError(
          400,
          'MISSING_QUERY_PARAMETER',
          `Query parameter "${requiredKey}" is required for this endpoint.`
        );
      }
    }
  }

  // Canonicalize query string by sorting keys so cache/dedup keys are deterministic
  validatedEntries.sort(([a], [b]) => a.localeCompare(b));
  const canonicalParams = new URLSearchParams();
  for (const [key, value] of validatedEntries) {
    canonicalParams.set(key, value);
  }

  const canonicalQueryString = canonicalParams.toString();
  const encodedPath = normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const upstreamUrl = canonicalQueryString
    ? `${TMDB_API_BASE_URL}/${encodedPath}?${canonicalQueryString}`
    : `${TMDB_API_BASE_URL}/${encodedPath}`;

  const cacheKey = canonicalQueryString ? `${normalizedPath}?${canonicalQueryString}` : normalizedPath;
  const policy = TMDB_CACHE_POLICIES[matchedRule.cacheCategory];

  return {
    normalizedPath,
    canonicalQueryString,
    upstreamUrl,
    cacheKey,
    policy,
    routeName: matchedRule.name,
  };
}

interface InstanceCacheEntry {
  bodyText: string;
  storedAt: number;
  policy: TmdbCachePolicy;
}

export type TmdbCacheStatus = 'MISS' | 'HIT' | 'STALE';

export interface TmdbProxyResponse {
  statusCode: 200;
  bodyText: string;
  cacheControl: string;
  cachePolicy: TmdbCacheCategory;
  cacheStatus: TmdbCacheStatus;
}

export interface ExecuteTmdbProxyOptions {
  signal?: AbortSignal;
  upstreamTimeoutMs?: number;
  fetchFn?: typeof fetch;
  getToken?: () => string | null;
  now?: () => number;
}

// Per-instance warm memory structures (NOT globally shared across Vercel serverless instances).
const instanceCache = new Map<string, InstanceCacheEntry>();
const inFlightRequests = new Map<string, Promise<InstanceCacheEntry>>();
let rateLimitBlockedUntilMs = 0;

/** Resets per-instance memory cache, in-flight map, and rate-limit cooldown (primarily for tests). */
export function resetTmdbProxyState(): void {
  instanceCache.clear();
  inFlightRequests.clear();
  rateLimitBlockedUntilMs = 0;
}

function getInstanceCacheEntry(cacheKey: string): InstanceCacheEntry | undefined {
  const existing = instanceCache.get(cacheKey);
  if (!existing) return undefined;
  // Refresh LRU order
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

function parseRetryAfterSeconds(headerValue: string | null): number {
  if (!headerValue) return DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS;
  const trimmed = headerValue.trim();

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Math.min(Math.max(parsed, 1), MAX_RATE_LIMIT_COOLDOWN_SECONDS);
  }

  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const deltaSeconds = Math.ceil((parsedDate - Date.now()) / 1000);
    if (deltaSeconds > 0) {
      return Math.min(deltaSeconds, MAX_RATE_LIMIT_COOLDOWN_SECONDS);
    }
  }

  return DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS;
}

function isTransientStaleEligibleError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.code === 'TMDB_RATE_LIMITED' ||
    err.code === 'TMDB_UPSTREAM_ERROR' ||
    err.code === 'UPSTREAM_TIMEOUT' ||
    err.code === 'UPSTREAM_FETCH_FAILED'
  );
}

function awaitWithCallerSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    const reason =
      signal.reason instanceof ApiError
        ? signal.reason
        : new ApiError(504, 'REQUEST_TIMEOUT', 'The request timed out.');
    return Promise.reject(reason);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      const reason =
        signal.reason instanceof ApiError
          ? signal.reason
          : new ApiError(504, 'REQUEST_TIMEOUT', 'The request timed out.');
      reject(reason);
    };

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

async function fetchUpstreamTmdb(
  validated: ValidatedTmdbRequest,
  token: string,
  options: {
    upstreamTimeoutMs: number;
    fetchFn: typeof fetch;
    now: () => number;
  }
): Promise<InstanceCacheEntry> {
  const response = await fetchWithTimeout(
    validated.upstreamUrl,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    options.upstreamTimeoutMs,
    options.fetchFn
  );

  if (response.status === 401 || response.status === 403) {
    // Evict warm instance cache if upstream credentials are invalid or revoked
    instanceCache.clear();
    throw new ApiError(502, 'TMDB_AUTH_ERROR', 'Upstream TMDB authentication failed.', {
      expose: true,
    });
  }

  if (response.status === 404) {
    // Evict any prior stale entry so a legitimate 404 can never be resurrected by a later 5xx
    instanceCache.delete(validated.cacheKey);
    throw new ApiError(404, 'TMDB_NOT_FOUND', 'The requested TMDB resource was not found.', {
      expose: true,
    });
  }

  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'));
    rateLimitBlockedUntilMs = options.now() + retryAfterSeconds * 1000;
    throw new ApiError(
      429,
      'TMDB_RATE_LIMITED',
      'TMDB rate limit exceeded. Please try again shortly.',
      {
        expose: true,
        retryAfterSeconds,
      }
    );
  }

  if (response.status >= 400 && response.status < 500) {
    // Never treat upstream 4xx client/validation rejections as transient stale-eligible errors
    throw new ApiError(
      400,
      'TMDB_REQUEST_REJECTED',
      `TMDB rejected the request with status ${response.status}.`,
      { expose: true }
    );
  }

  if (response.status >= 500) {
    throw new ApiError(
      502,
      'TMDB_UPSTREAM_ERROR',
      'TMDB upstream service is temporarily unavailable.',
      { expose: true }
    );
  }

  if (!response.ok) {
    throw new ApiError(
      502,
      'TMDB_UPSTREAM_ERROR',
      `TMDB upstream request failed with status ${response.status}.`,
      { expose: true }
    );
  }

  const rawBody = await response.text();
  try {
    JSON.parse(rawBody);
  } catch {
    throw new ApiError(502, 'TMDB_INVALID_RESPONSE', 'TMDB returned an invalid JSON payload.', {
      expose: true,
    });
  }

  const entry: InstanceCacheEntry = {
    bodyText: rawBody,
    storedAt: options.now(),
    policy: validated.policy,
  };
  setInstanceCacheEntry(validated.cacheKey, entry);
  return entry;
}

/**
 * Executes a validated TMDB proxy request using server-only TMDB_API_TOKEN,
 * per-instance in-flight request deduplication, rate-limit protection,
 * safe stale-on-error fallback, and Vercel CDN Cache-Control policies.
 */
export async function executeTmdbProxyRequest(
  validated: ValidatedTmdbRequest,
  options: ExecuteTmdbProxyOptions = {}
): Promise<TmdbProxyResponse> {
  const now = options.now ?? Date.now;
  const fetchFn = options.fetchFn ?? fetch;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const token = (options.getToken ?? (() => getTmdbApiToken()))();

  if (!token) {
    throw new ApiError(
      503,
      'TMDB_NOT_CONFIGURED',
      'TMDB API credentials are not configured on the server.',
      { expose: true }
    );
  }

  const currentTime = now();
  const cached = getInstanceCacheEntry(validated.cacheKey);

  // Serve from short per-instance burst cache if still within brief fresh TTL
  if (cached && currentTime - cached.storedAt < validated.policy.instanceFreshTtlMs) {
    return {
      statusCode: 200,
      bodyText: cached.bodyText,
      cacheControl: buildCacheControlHeader(validated.policy),
      cachePolicy: validated.policy.category,
      cacheStatus: 'HIT',
    };
  }

  const canServeStale =
    Boolean(cached) && currentTime - cached!.storedAt <= validated.policy.instanceStaleTtlMs;

  // Respect upstream 429 cooldown window before calling TMDB again
  if (rateLimitBlockedUntilMs > currentTime) {
    if (canServeStale && cached) {
      return {
        statusCode: 200,
        bodyText: cached.bodyText,
        cacheControl: buildCacheControlHeader(validated.policy, { staleFallback: true }),
        cachePolicy: validated.policy.category,
        cacheStatus: 'STALE',
      };
    }

    const remainingSeconds = Math.max(1, Math.ceil((rateLimitBlockedUntilMs - currentTime) / 1000));
    throw new ApiError(
      429,
      'TMDB_RATE_LIMITED',
      'TMDB rate limit exceeded. Please try again shortly.',
      {
        expose: true,
        retryAfterSeconds: remainingSeconds,
      }
    );
  }

  // Deduplicate concurrent identical upstream requests within the same warm serverless instance
  let sharedPromise = inFlightRequests.get(validated.cacheKey);
  if (!sharedPromise) {
    sharedPromise = fetchUpstreamTmdb(validated, token, {
      upstreamTimeoutMs,
      fetchFn,
      now,
    }).finally(() => {
      inFlightRequests.delete(validated.cacheKey);
    });
    inFlightRequests.set(validated.cacheKey, sharedPromise);
  }

  try {
    const entry = await awaitWithCallerSignal(sharedPromise, options.signal);
    return {
      statusCode: 200,
      bodyText: entry.bodyText,
      cacheControl: buildCacheControlHeader(validated.policy),
      cachePolicy: validated.policy.category,
      cacheStatus: 'MISS',
    };
  } catch (err: unknown) {
    // Only fall back to a previously valid cached payload on transient upstream failures.
    // Never mask 401 auth errors, 404 not found, or return fake empty datasets.
    if (canServeStale && cached && isTransientStaleEligibleError(err)) {
      return {
        statusCode: 200,
        bodyText: cached.bodyText,
        cacheControl: buildCacheControlHeader(validated.policy, { staleFallback: true }),
        cachePolicy: validated.policy.category,
        cacheStatus: 'STALE',
      };
    }
    throw err;
  }
}
