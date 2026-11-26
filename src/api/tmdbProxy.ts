export const TMDB_PROXY_BASE_PATH = '/api/tmdb';
export const TMDB_MAX_SEARCH_QUERY_LENGTH = 200;

export const TMDB_PROXY_FETCH_INIT: Readonly<RequestInit> = Object.freeze({
  method: 'GET',
  headers: Object.freeze({
    Accept: 'application/json',
  }),
});

export type TmdbQueryParamValue = string | number | boolean | null | undefined;
export type TmdbQueryParams = Record<string, TmdbQueryParamValue>;

const CONTROL_CHAR_GLOBAL_REGEX = /[\u0000-\u001f\u007f]/g;
const POSITIVE_TMDB_ID_REGEX = /^[1-9]\d{0,9}$/;
const SEASON_NUMBER_REGEX = /^(0|[1-9]\d{0,3})$/;

export class TmdbHttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'TmdbHttpError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Deterministically canonicalizes TMDB `append_to_response` values:
 * splits comma-separated tokens, trims, removes empties/duplicates,
 * and sorts in standard lexicographical order matching `/api/tmdb`.
 */
export function canonicalizeAppendToResponse(tokens: string | readonly string[]): string {
  const rawList = Array.isArray(tokens) ? tokens : String(tokens).split(',');
  const unique = new Set<string>();

  for (const token of rawList) {
    const cleaned = String(token).trim();
    if (cleaned.length > 0) {
      unique.add(cleaned);
    }
  }

  return Array.from(unique)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(',');
}

/**
 * Guards search queries before calling `/api/tmdb/search/*`:
 * - Strips ASCII control characters rejected by the proxy.
 * - Trims whitespace.
 * - Caps length to TMDB_MAX_SEARCH_QUERY_LENGTH (200 chars).
 * - Returns `null` when empty so callers can short-circuit without triggering 400.
 */
export function sanitizeTmdbSearchQuery(rawQuery: string | null | undefined): string | null {
  if (typeof rawQuery !== 'string') return null;
  const cleaned = rawQuery.replace(CONTROL_CHAR_GLOBAL_REGEX, ' ').trim();
  if (cleaned.length === 0) return null;
  const bounded = cleaned.slice(0, TMDB_MAX_SEARCH_QUERY_LENGTH).trim();
  return bounded.length > 0 ? bounded : null;
}

/**
 * Cleans title strings used for fallback `/api/tmdb/search/multi` lookups
 * (logo resolution & anime TMDB enrichment) and returns `null` if nothing searchable remains.
 */
export function sanitizeTmdbTitleFallbackQuery(rawTitle: string | null | undefined): string | null {
  if (typeof rawTitle !== 'string') return null;
  const cleaned = rawTitle
    .replace(/×/g, 'x')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitizeTmdbSearchQuery(cleaned);
}

/**
 * Validates positive TMDB numeric identifiers matching `/api/tmdb`'s `([1-9]\d{0,9})` allowlist.
 */
export function isValidTmdbId(id: number | string | null | undefined): boolean {
  if (typeof id === 'number') {
    return Number.isInteger(id) && id > 0 && POSITIVE_TMDB_ID_REGEX.test(String(id));
  }
  if (typeof id === 'string') {
    return POSITIVE_TMDB_ID_REGEX.test(id.trim());
  }
  return false;
}

/**
 * Validates TMDB TV season numbers matching `/api/tmdb`'s `(0|[1-9]\d{0,3})` allowlist.
 */
export function isValidTmdbSeasonNumber(seasonNumber: number | string | null | undefined): boolean {
  if (typeof seasonNumber === 'number') {
    return Number.isInteger(seasonNumber) && seasonNumber >= 0 && SEASON_NUMBER_REGEX.test(String(seasonNumber));
  }
  if (typeof seasonNumber === 'string') {
    return SEASON_NUMBER_REGEX.test(seasonNumber.trim());
  }
  return false;
}

/**
 * Builds a deterministic same-origin `/api/tmdb/*` URL with lexicographically sorted
 * query parameters and canonicalized `append_to_response` tokens for optimal Vercel CDN cache hits.
 */
export function buildTmdbProxyUrl(endpointPath: string, params?: TmdbQueryParams): string {
  const normalizedPath = endpointPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const base = normalizedPath ? `${TMDB_PROXY_BASE_PATH}/${normalizedPath}` : TMDB_PROXY_BASE_PATH;

  if (!params) {
    return base;
  }

  const normalizedEntries: Array<[string, string]> = [];

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null) continue;
    let valueStr = typeof rawValue === 'boolean' ? (rawValue ? 'true' : 'false') : String(rawValue);

    if (key === 'append_to_response') {
      valueStr = canonicalizeAppendToResponse(valueStr);
    }

    if (valueStr.length === 0) continue;
    normalizedEntries.push([key, valueStr]);
  }

  if (normalizedEntries.length === 0) {
    return base;
  }

  normalizedEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const searchParams = new URLSearchParams();
  for (const [key, value] of normalizedEntries) {
    searchParams.append(key, value);
  }

  return `${base}?${searchParams.toString()}`;
}

/**
 * Determines whether a TMDB proxy failure is transient and safe to retry.
 * Ordinary client errors (400, 401, 403, 404, 405, 422) are NEVER retried.
 */
export function isTransientTmdbError(error: unknown): boolean {
  if (error instanceof TmdbHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return true;
}

/**
 * Issues a GET request to Miyoro's `/api/tmdb/*` backend proxy with zero client-side
 * TMDB credentials or Authorization headers.
 */
export function tmdbProxyFetch(
  endpointPath: string,
  params?: TmdbQueryParams,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const url = buildTmdbProxyUrl(endpointPath, params);
  return fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
}
