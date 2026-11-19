import { getAnilistApiUrl } from './env.js';
import { ApiError, fetchWithTimeout } from './http.js';

export const ANILIST_MAX_BODY_BYTES = 8 * 1024; // 8 KB
const ANILIST_MAX_QUERY_CHARS = 4096;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 7000;
const MAX_MEMORY_CACHE_ENTRIES = 150;
const MAX_MEMORY_FRESH_TTL_SECONDS = 30;
const MAX_RATE_LIMIT_COOLDOWN_SECONDS = 60;
const DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 15;

export type AnilistOperationName =
  | 'trending'
  | 'newlyAdded'
  | 'details'
  | 'byGenre'
  | 'byTag'
  | 'topRated'
  | 'top100'
  | 'search';

export type AnilistCacheCategory = 'trending' | 'catalog' | 'search' | 'details';

export interface AnilistCachePolicy {
  category: AnilistCacheCategory;
  /** Vercel shared CDN fresh duration in seconds (`s-maxage`, GET responses only). */
  sMaxAgeSeconds: number;
  /** Vercel shared CDN stale-while-revalidate window in seconds (GET responses only). */
  staleWhileRevalidateSeconds: number;
  /**
   * Short per-instance burst absorption TTL in milliseconds.
   * NOTE: Per-instance memory is NOT globally shared across Vercel serverless instances.
   */
  instanceFreshTtlMs: number;
  /**
   * Maximum age in milliseconds a warm instance may serve a cached valid payload
   * as a stale fallback when AniList fails transiently (429 / 5xx / timeout / network).
   */
  instanceStaleTtlMs: number;
}

export const ANILIST_CACHE_POLICIES: Record<AnilistCacheCategory, AnilistCachePolicy> = {
  trending: {
    category: 'trending',
    sMaxAgeSeconds: 900, // 15 minutes
    staleWhileRevalidateSeconds: 1800, // 30 minutes
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (900 + 1800) * 1000,
  },
  catalog: {
    category: 'catalog',
    sMaxAgeSeconds: 1800, // 30 minutes
    staleWhileRevalidateSeconds: 3600, // 60 minutes
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (1800 + 3600) * 1000,
  },
  search: {
    category: 'search',
    sMaxAgeSeconds: 120, // 2 minutes
    staleWhileRevalidateSeconds: 300, // 5 minutes
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (120 + 300) * 1000,
  },
  details: {
    category: 'details',
    sMaxAgeSeconds: 21600, // 6 hours
    staleWhileRevalidateSeconds: 43200, // 12 hours
    instanceFreshTtlMs: MAX_MEMORY_FRESH_TTL_SECONDS * 1000,
    instanceStaleTtlMs: (21600 + 43200) * 1000,
  },
};

export function buildAnilistCacheControlHeader(
  method: 'GET' | 'POST',
  policy: AnilistCachePolicy,
  options: { staleFallback?: boolean } = {}
): string {
  // Never emit public caching headers for POST requests.
  if (method !== 'GET') {
    return 'no-store';
  }
  if (options.staleFallback) {
    return 'public, max-age=0, s-maxage=30, stale-while-revalidate=60';
  }
  return `public, max-age=0, s-maxage=${policy.sMaxAgeSeconds}, stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`;
}

/**
 * Exact AniList Media selection set used across all Miyoro anime queries.
 */
export const ANILIST_MEDIA_FIELDS = `
  id
  title { romaji english native }
  description
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  startDate { year month day }
  status
  episodes
  genres
  trailer { id site }
  relations {
    edges {
      relationType
      node {
        id
        type
        format
        title { romaji english }
      }
    }
  }
  streamingEpisodes {
    title
    thumbnail
    url
    site
  }
`.trim();

type VariableKey = 'perPage' | 'page' | 'id' | 'genre' | 'tag' | 'search';

interface OperationSpec {
  operation: AnilistOperationName;
  cacheCategory: AnilistCacheCategory;
  query: string;
  allowedVariables: readonly VariableKey[];
  requiredVariables: readonly VariableKey[];
  defaults: Partial<Record<VariableKey, number>>;
}

const ANILIST_OPERATION_SPECS: Record<AnilistOperationName, OperationSpec> = {
  trending: {
    operation: 'trending',
    cacheCategory: 'trending',
    query: `
      query ($perPage: Int) {
        Page (page: 1, perPage: $perPage) {
          media (type: ANIME, sort: TRENDING_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
            ${ANILIST_MEDIA_FIELDS}
          }
        }
      }
    `.trim(),
    allowedVariables: ['perPage'],
    requiredVariables: [],
    defaults: { perPage: 10 },
  },
  newlyAdded: {
    operation: 'newlyAdded',
    cacheCategory: 'trending',
    query: `
      query ($perPage: Int) {
        Page (page: 1, perPage: $perPage) {
          media (type: ANIME, sort: START_DATE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
            ${ANILIST_MEDIA_FIELDS}
          }
        }
      }
    `.trim(),
    allowedVariables: ['perPage'],
    requiredVariables: [],
    defaults: { perPage: 10 },
  },
  details: {
    operation: 'details',
    cacheCategory: 'details',
    query: `
      query ($id: Int) {
        Media (id: $id, type: ANIME) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    `.trim(),
    allowedVariables: ['id'],
    requiredVariables: ['id'],
    defaults: {},
  },
  byGenre: {
    operation: 'byGenre',
    cacheCategory: 'catalog',
    query: `
      query ($genre: String, $perPage: Int) {
        Page (page: 1, perPage: $perPage) {
          media (type: ANIME, genre: $genre, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
            ${ANILIST_MEDIA_FIELDS}
          }
        }
      }
    `.trim(),
    allowedVariables: ['genre', 'perPage'],
    requiredVariables: ['genre'],
    defaults: { perPage: 20 },
  },
  byTag: {
    operation: 'byTag',
    cacheCategory: 'catalog',
    query: `
      query ($tag: String, $perPage: Int) {
        Page (page: 1, perPage: $perPage) {
          media (type: ANIME, tag: $tag, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
            ${ANILIST_MEDIA_FIELDS}
          }
        }
      }
    `.trim(),
    allowedVariables: ['tag', 'perPage'],
    requiredVariables: ['tag'],
    defaults: { perPage: 20 },
  },
  topRated: {
    operation: 'topRated',
    cacheCategory: 'catalog',
    query: `
      query ($page: Int, $perPage: Int) {
        Page (page: $page, perPage: $perPage) {
          media (type: ANIME, sort: SCORE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
            ${ANILIST_MEDIA_FIELDS}
          }
        }
      }
    `.trim(),
    allowedVariables: ['page', 'perPage'],
    requiredVariables: [],
    defaults: { page: 1, perPage: 20 },
  },
  top100: {
    operation: 'top100',
    cacheCategory: 'catalog',
    query: `
      query ($perPage: Int) {
        Page (page: 1, perPage: $perPage) {
          media (type: ANIME, sort: SCORE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
            ${ANILIST_MEDIA_FIELDS}
          }
        }
      }
    `.trim(),
    allowedVariables: ['perPage'],
    requiredVariables: [],
    defaults: { perPage: 30 },
  },
  search: {
    operation: 'search',
    cacheCategory: 'search',
    query: `
      query ($search: String, $perPage: Int) {
        Page (page: 1, perPage: $perPage) {
          media (type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
            ${ANILIST_MEDIA_FIELDS}
          }
        }
      }
    `.trim(),
    allowedVariables: ['search', 'perPage'],
    requiredVariables: ['search'],
    defaults: { perPage: 20 },
  },
};

export const SUPPORTED_ANILIST_OPERATIONS = Object.keys(
  ANILIST_OPERATION_SPECS
) as readonly AnilistOperationName[];

// ---------------------------------------------------------------------------
// Strict GraphQL Token-Stream Validator (no naive string/whitespace matching)
// ---------------------------------------------------------------------------

type GraphqlTokenKind = 'NAME' | 'INT' | 'PUNCT';

interface GraphqlToken {
  kind: GraphqlTokenKind;
  value: string;
}

const RAW_CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const STRICT_CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/;
const FORBIDDEN_GRAPHQL_KEYWORDS = new Set(['mutation', 'subscription', 'fragment']);
const GENRE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]*$/;
const TAG_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s'\/-]*$/;
const POSITIVE_INT_STRING_REGEX = /^[1-9]\d{0,9}$/;
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Lexes a GraphQL query document into a strict token stream for the safe subset
 * used by Miyoro's read-only catalog queries.
 *
 * Explicitly rejects:
 * - Comments (`#`), directives (`@`), fragments/spreads (`...`), string literals (`"`), floats
 * - Mutations, subscriptions, fragment definitions, and introspection (`__*`)
 * - Field aliases (colons `:` outside parenthesized argument/variable lists)
 * - Unbalanced braces or parentheses
 */
function tokenizeApprovedGraphqlSubset(source: string): GraphqlToken[] {
  if (typeof source !== 'string' || !source.trim()) {
    throw new ApiError(400, 'INVALID_GRAPHQL_QUERY', 'A non-empty GraphQL query string is required.');
  }
  if (source.length > ANILIST_MAX_QUERY_CHARS || RAW_CONTROL_CHAR_REGEX.test(source)) {
    throw new ApiError(400, 'INVALID_GRAPHQL_QUERY', 'GraphQL query exceeds limits or contains invalid characters.');
  }

  const tokens: GraphqlToken[] = [];
  let i = 0;
  let braceDepth = 0;
  let parenDepth = 0;

  while (i < source.length) {
    const ch = source[i];

    // Whitespace and GraphQL insignificant commas
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',' || ch === '\ufeff') {
      i += 1;
      continue;
    }

    // Disallow comments, directives, strings, spreads, and arbitrary symbols
    if (ch === '#' || ch === '@' || ch === '"' || ch === '.') {
      throw new ApiError(
        400,
        'UNSUPPORTED_ANILIST_QUERY',
        'GraphQL comments, directives, fragments, and string literals are not permitted.'
      );
    }

    if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === ':' || ch === '$') {
      if (ch === '{') braceDepth += 1;
      if (ch === '}') {
        braceDepth -= 1;
        if (braceDepth < 0) {
          throw new ApiError(400, 'INVALID_GRAPHQL_QUERY', 'Malformed GraphQL query braces.');
        }
      }
      if (ch === '(') parenDepth += 1;
      if (ch === ')') {
        parenDepth -= 1;
        if (parenDepth < 0) {
          throw new ApiError(400, 'INVALID_GRAPHQL_QUERY', 'Malformed GraphQL query parentheses.');
        }
      }
      if (ch === ':' && parenDepth === 0) {
        // Colons outside (...) represent GraphQL field aliases, which are disallowed.
        throw new ApiError(
          400,
          'UNSUPPORTED_ANILIST_QUERY',
          'GraphQL field aliases are not permitted.'
        );
      }

      tokens.push({ kind: 'PUNCT', value: ch });
      i += 1;
      continue;
    }

    // Identifier / Name: [_A-Za-z][_0-9A-Za-z]*
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_') {
      let end = i + 1;
      while (end < source.length) {
        const next = source[end];
        const isWord =
          (next >= 'A' && next <= 'Z') ||
          (next >= 'a' && next <= 'z') ||
          (next >= '0' && next <= '9') ||
          next === '_';
        if (!isWord) break;
        end += 1;
      }
      const word = source.slice(i, end);

      if (FORBIDDEN_GRAPHQL_KEYWORDS.has(word)) {
        throw new ApiError(
          400,
          'UNSUPPORTED_ANILIST_QUERY',
          `GraphQL "${word}" operations are not permitted on this endpoint.`
        );
      }
      if (word.startsWith('__')) {
        throw new ApiError(
          400,
          'UNSUPPORTED_ANILIST_QUERY',
          'GraphQL introspection queries are not permitted.'
        );
      }

      tokens.push({ kind: 'NAME', value: word });
      i = end;
      continue;
    }

    // Integer literal (non-negative integers used in allowlisted templates, e.g. page: 1)
    if (ch >= '0' && ch <= '9') {
      let end = i + 1;
      while (end < source.length && source[end] >= '0' && source[end] <= '9') {
        end += 1;
      }
      if (end < source.length && source[end] === '.') {
        throw new ApiError(400, 'UNSUPPORTED_ANILIST_QUERY', 'Unsupported numeric literal in GraphQL query.');
      }
      tokens.push({ kind: 'INT', value: source.slice(i, end) });
      i = end;
      continue;
    }

    throw new ApiError(
      400,
      'UNSUPPORTED_ANILIST_QUERY',
      'GraphQL query contains unsupported syntax or characters.'
    );
  }

  if (braceDepth !== 0 || parenDepth !== 0 || tokens.length === 0) {
    throw new ApiError(400, 'INVALID_GRAPHQL_QUERY', 'Malformed GraphQL query document.');
  }

  return tokens;
}

function serializeTokenFingerprint(tokens: readonly GraphqlToken[]): string {
  return tokens.map((t) => `${t.kind}:${t.value}`).join('|');
}

// Precompute canonical token fingerprints for all approved operations once at module load.
const APPROVED_TEMPLATE_BY_FINGERPRINT = new Map<string, OperationSpec>();
for (const spec of Object.values(ANILIST_OPERATION_SPECS)) {
  const fingerprint = serializeTokenFingerprint(tokenizeApprovedGraphqlSubset(spec.query));
  if (APPROVED_TEMPLATE_BY_FINGERPRINT.has(fingerprint)) {
    throw new Error(`Duplicate AniList GraphQL template fingerprint for operation "${spec.operation}".`);
  }
  APPROVED_TEMPLATE_BY_FINGERPRINT.set(fingerprint, spec);
}

// ---------------------------------------------------------------------------
// Variable Validation & Canonicalization
// ---------------------------------------------------------------------------

function validateIntegerVariable(
  key: 'perPage' | 'page' | 'id',
  rawValue: unknown,
  source: 'POST' | 'GET',
  min: number,
  max: number
): number {
  let num: number;

  if (source === 'POST') {
    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue)) {
      throw new ApiError(
        400,
        'INVALID_VARIABLE',
        `Variable "${key}" must be an integer between ${min} and ${max}.`
      );
    }
    num = rawValue;
  } else {
    if (typeof rawValue !== 'string' || !POSITIVE_INT_STRING_REGEX.test(rawValue.trim())) {
      throw new ApiError(
        400,
        'INVALID_QUERY_PARAMETER',
        `Query parameter "${key}" must be an integer between ${min} and ${max}.`
      );
    }
    num = Number.parseInt(rawValue.trim(), 10);
  }

  if (!Number.isSafeInteger(num) || num < min || num > max) {
    const code = source === 'POST' ? 'INVALID_VARIABLE' : 'INVALID_QUERY_PARAMETER';
    const label = source === 'POST' ? 'Variable' : 'Query parameter';
    throw new ApiError(400, code, `${label} "${key}" must be an integer between ${min} and ${max}.`);
  }

  return num;
}

function validateStringVariable(
  key: 'genre' | 'tag' | 'search',
  rawValue: unknown,
  source: 'POST' | 'GET'
): string {
  const code = source === 'POST' ? 'INVALID_VARIABLE' : 'INVALID_QUERY_PARAMETER';
  const label = source === 'POST' ? 'Variable' : 'Query parameter';

  if (typeof rawValue !== 'string') {
    throw new ApiError(400, code, `${label} "${key}" must be a non-empty string.`);
  }
  if (STRICT_CONTROL_CHAR_REGEX.test(rawValue)) {
    throw new ApiError(400, code, `${label} "${key}" contains invalid control characters.`);
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new ApiError(400, code, `${label} "${key}" must be a non-empty string.`);
  }

  if (key === 'genre') {
    if (trimmed.length > 64 || !GENRE_REGEX.test(trimmed)) {
      throw new ApiError(400, code, `${label} "genre" contains invalid characters or exceeds 64 characters.`);
    }
    return trimmed;
  }

  if (key === 'tag') {
    if (trimmed.length > 64 || !TAG_REGEX.test(trimmed)) {
      throw new ApiError(400, code, `${label} "tag" contains invalid characters or exceeds 64 characters.`);
    }
    return trimmed;
  }

  // search
  if (trimmed.length > 120) {
    throw new ApiError(400, code, `${label} "search" exceeds maximum length of 120 characters.`);
  }
  return trimmed;
}

function validateVariableValue(
  key: VariableKey,
  rawValue: unknown,
  source: 'POST' | 'GET'
): number | string {
  switch (key) {
    case 'perPage':
      return validateIntegerVariable('perPage', rawValue, source, 1, 50);
    case 'page':
      return validateIntegerVariable('page', rawValue, source, 1, 500);
    case 'id':
      return validateIntegerVariable('id', rawValue, source, 1, 2_147_483_647);
    case 'genre':
    case 'tag':
    case 'search':
      return validateStringVariable(key, rawValue, source);
  }
}

function buildCanonicalVariables(
  spec: OperationSpec,
  rawVariables: Record<string, unknown>,
  source: 'POST' | 'GET'
): Record<string, number | string> {
  const allowedSet = new Set<string>(spec.allowedVariables);
  const code = source === 'POST' ? 'INVALID_VARIABLE' : 'INVALID_QUERY_PARAMETER';
  const label = source === 'POST' ? 'Variable' : 'Query parameter';

  for (const key of Object.keys(rawVariables)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key) || !allowedSet.has(key)) {
      throw new ApiError(
        400,
        code,
        `${label} "${key}" is not supported for AniList operation "${spec.operation}".`
      );
    }
  }

  const canonicalEntries: [VariableKey, number | string][] = [];
  const sortedKeys = [...spec.allowedVariables].sort((a, b) => a.localeCompare(b));

  for (const key of sortedKeys) {
    const hasOwn = Object.prototype.hasOwnProperty.call(rawVariables, key);
    const rawVal = hasOwn ? rawVariables[key] : undefined;

    if (hasOwn && rawVal !== undefined) {
      canonicalEntries.push([key, validateVariableValue(key, rawVal, source)]);
    } else if (spec.requiredVariables.includes(key)) {
      const missingCode = source === 'POST' ? 'MISSING_VARIABLE' : 'MISSING_QUERY_PARAMETER';
      throw new ApiError(
        400,
        missingCode,
        `${label} "${key}" is required for AniList operation "${spec.operation}".`
      );
    } else if (spec.defaults[key] !== undefined) {
      canonicalEntries.push([key, spec.defaults[key]!]);
    }
  }

  const canonical: Record<string, number | string> = {};
  for (const [k, v] of canonicalEntries) {
    canonical[k] = v;
  }
  return canonical;
}

export interface ValidatedAnilistRequest {
  method: 'GET' | 'POST';
  operation: AnilistOperationName;
  canonicalQuery: string;
  canonicalVariables: Record<string, number | string>;
  canonicalGetQueryString: string;
  cacheKey: string;
  policy: AnilistCachePolicy;
}

/**
 * Produces a deterministic GET query string with sorted parameter keys
 * (`op` + sorted canonical variables) for CDN cache-key consistency.
 */
export function buildCanonicalAnilistGetQuery(
  operation: AnilistOperationName,
  canonicalVariables: Record<string, number | string>
): string {
  const entries: [string, string][] = [['op', operation]];
  for (const [k, v] of Object.entries(canonicalVariables)) {
    entries.push([k, String(v)]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  const params = new URLSearchParams();
  for (const [k, v] of entries) {
    params.set(k, v);
  }
  return params.toString();
}

function finalizeValidatedRequest(
  method: 'GET' | 'POST',
  spec: OperationSpec,
  canonicalVariables: Record<string, number | string>
): ValidatedAnilistRequest {
  const canonicalVariablesJson = JSON.stringify(canonicalVariables);
  const cacheKey = `${spec.operation}:${canonicalVariablesJson}`;
  const policy = ANILIST_CACHE_POLICIES[spec.cacheCategory];

  return {
    method,
    operation: spec.operation,
    canonicalQuery: spec.query,
    canonicalVariables,
    canonicalGetQueryString: buildCanonicalAnilistGetQuery(spec.operation, canonicalVariables),
    cacheKey,
    policy,
  };
}

/**
 * Validates a `GET /api/anilist?op=...` request against Miyoro's server-defined
 * public catalog operations. Never accepts arbitrary GraphQL strings via GET.
 */
export function validateAnilistGetRequest(query: URLSearchParams): ValidatedAnilistRequest {
  const opValues = query.getAll('op');
  if (opValues.length === 0 || !opValues[0]?.trim()) {
    throw new ApiError(
      400,
      'MISSING_QUERY_PARAMETER',
      'Query parameter "op" is required for GET /api/anilist requests.'
    );
  }
  if (opValues.length > 1) {
    throw new ApiError(400, 'INVALID_QUERY_PARAMETER', 'Duplicate query parameter "op" is not permitted.');
  }

  const rawOp = opValues[0].trim();
  if (!Object.prototype.hasOwnProperty.call(ANILIST_OPERATION_SPECS, rawOp)) {
    throw new ApiError(
      400,
      'UNSUPPORTED_OPERATION',
      `AniList operation "${rawOp}" is not supported.`
    );
  }
  const spec = ANILIST_OPERATION_SPECS[rawOp as AnilistOperationName];

  const seenKeys = new Set<string>();
  const rawVariables: Record<string, unknown> = {};

  for (const [key, value] of query.entries()) {
    if (key === 'op') {
      continue;
    }
    if (seenKeys.has(key)) {
      throw new ApiError(
        400,
        'INVALID_QUERY_PARAMETER',
        `Duplicate query parameter "${key}" is not permitted.`
      );
    }
    seenKeys.add(key);
    rawVariables[key] = value;
  }

  const canonicalVariables = buildCanonicalVariables(spec, rawVariables, 'GET');
  return finalizeValidatedRequest('GET', spec, canonicalVariables);
}

const ALLOWED_POST_BODY_KEYS = new Set(['query', 'variables']);

/**
 * Validates a `POST /api/anilist` GraphQL request body (`{ query, variables }`).
 * Strictly verifies top-level fields, tokenizes the GraphQL document, matches it
 * against Miyoro's approved templates, and validates all variables.
 */
export function validateAnilistPostRequest(
  body: unknown,
  queryParams?: URLSearchParams
): ValidatedAnilistRequest {
  if (queryParams && [...queryParams.keys()].length > 0) {
    throw new ApiError(
      400,
      'INVALID_QUERY_PARAMETER',
      'Query parameters are not supported on POST /api/anilist requests.'
    );
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(
      400,
      'INVALID_REQUEST_BODY',
      'Request body must be a JSON object containing "query" and optional "variables".'
    );
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key) || !ALLOWED_POST_BODY_KEYS.has(key)) {
      throw new ApiError(
        400,
        'INVALID_REQUEST_BODY',
        `Unexpected request body field "${key}". Only "query" and "variables" are permitted.`
      );
    }
  }

  if (typeof record.query !== 'string' || !record.query.trim()) {
    throw new ApiError(400, 'INVALID_GRAPHQL_QUERY', 'Field "query" must be a non-empty string.');
  }

  const tokens = tokenizeApprovedGraphqlSubset(record.query);
  const fingerprint = serializeTokenFingerprint(tokens);
  const matchedSpec = APPROVED_TEMPLATE_BY_FINGERPRINT.get(fingerprint);

  if (!matchedSpec) {
    throw new ApiError(
      400,
      'UNSUPPORTED_ANILIST_QUERY',
      'The provided GraphQL query is not an approved Miyoro AniList operation.'
    );
  }

  let rawVariables: Record<string, unknown> = {};
  if (record.variables !== undefined) {
    if (
      record.variables === null ||
      typeof record.variables !== 'object' ||
      Array.isArray(record.variables)
    ) {
      throw new ApiError(400, 'INVALID_VARIABLE', 'Field "variables" must be a JSON object.');
    }
    rawVariables = record.variables as Record<string, unknown>;
  }

  const canonicalVariables = buildCanonicalVariables(matchedSpec, rawVariables, 'POST');
  return finalizeValidatedRequest('POST', matchedSpec, canonicalVariables);
}

// ---------------------------------------------------------------------------
// Per-Instance Warm Memory Cache, In-Flight Deduplication & 429 Protection
// ---------------------------------------------------------------------------

interface InstanceCacheEntry {
  bodyText: string;
  storedAt: number;
  policy: AnilistCachePolicy;
}

export type AnilistCacheStatus = 'MISS' | 'HIT' | 'STALE';

export interface AnilistProxyResponse {
  statusCode: 200;
  bodyText: string;
  cacheControl: string;
  cachePolicy: AnilistCacheCategory;
  cacheStatus: AnilistCacheStatus;
  operation: AnilistOperationName;
}

export interface ExecuteAnilistProxyOptions {
  signal?: AbortSignal;
  upstreamTimeoutMs?: number;
  fetchFn?: typeof fetch;
  getApiUrl?: () => string;
  now?: () => number;
}

// Per-instance warm memory structures (NOT globally shared across Vercel serverless instances).
const instanceCache = new Map<string, InstanceCacheEntry>();
const inFlightRequests = new Map<string, Promise<InstanceCacheEntry>>();
let rateLimitBlockedUntilMs = 0;

/** Resets per-instance memory cache, in-flight map, and rate-limit cooldown (primarily for tests). */
export function resetAnilistProxyState(): void {
  instanceCache.clear();
  inFlightRequests.clear();
  rateLimitBlockedUntilMs = 0;
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

function parseRateLimitCooldownSeconds(
  retryAfterHeader: string | null,
  rateLimitResetHeader: string | null,
  currentTimeMs: number
): number {
  if (retryAfterHeader) {
    const trimmed = retryAfterHeader.trim();
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
  }

  if (rateLimitResetHeader && /^\d+$/.test(rateLimitResetHeader.trim())) {
    const resetEpochSeconds = Number.parseInt(rateLimitResetHeader.trim(), 10);
    const deltaSeconds = Math.ceil(resetEpochSeconds - currentTimeMs / 1000);
    if (deltaSeconds > 0) {
      return Math.min(deltaSeconds, MAX_RATE_LIMIT_COOLDOWN_SECONDS);
    }
  }

  return DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS;
}

function isTransientStaleEligibleError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.code === 'ANILIST_RATE_LIMITED' ||
    err.code === 'ANILIST_UPSTREAM_ERROR' ||
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

function inspectGraphqlPayloadOrThrow(
  parsed: unknown,
  validated: ValidatedAnilistRequest,
  responseHeaders: Headers,
  currentTimeMs: number
): void {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(502, 'ANILIST_INVALID_RESPONSE', 'AniList returned an invalid GraphQL payload.', {
      expose: true,
    });
  }

  const envelope = parsed as { data?: unknown; errors?: unknown };

  if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    const firstError = envelope.errors[0] as { status?: unknown; message?: unknown } | undefined;
    const graphqlStatus = typeof firstError?.status === 'number' ? firstError.status : undefined;
    const graphqlMessage = typeof firstError?.message === 'string' ? firstError.message.toLowerCase() : '';

    if (graphqlStatus === 404 || graphqlMessage.includes('not found')) {
      instanceCache.delete(validated.cacheKey);
      throw new ApiError(404, 'ANILIST_NOT_FOUND', 'The requested AniList resource was not found.', {
        expose: true,
      });
    }

    if (graphqlStatus === 429 || graphqlMessage.includes('too many requests')) {
      const retryAfterSeconds = parseRateLimitCooldownSeconds(
        responseHeaders.get('retry-after'),
        responseHeaders.get('x-ratelimit-reset'),
        currentTimeMs
      );
      rateLimitBlockedUntilMs = currentTimeMs + retryAfterSeconds * 1000;
      throw new ApiError(
        429,
        'ANILIST_RATE_LIMITED',
        'AniList rate limit exceeded. Please try again shortly.',
        {
          expose: true,
          retryAfterSeconds,
        }
      );
    }

    if (graphqlStatus !== undefined && graphqlStatus >= 500) {
      throw new ApiError(
        502,
        'ANILIST_UPSTREAM_ERROR',
        'AniList upstream service is temporarily unavailable.',
        { expose: true }
      );
    }

    throw new ApiError(
      502,
      'ANILIST_GRAPHQL_ERROR',
      'AniList returned a GraphQL error for this request.',
      { expose: true }
    );
  }

  if (envelope.data === null || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
    throw new ApiError(
      502,
      'ANILIST_INVALID_RESPONSE',
      'AniList returned a response without valid GraphQL data.',
      { expose: true }
    );
  }
}

async function fetchUpstreamAnilist(
  validated: ValidatedAnilistRequest,
  apiUrl: string,
  options: {
    upstreamTimeoutMs: number;
    fetchFn: typeof fetch;
    now: () => number;
  }
): Promise<InstanceCacheEntry> {
  const response = await fetchWithTimeout(
    apiUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: validated.canonicalQuery,
        variables: validated.canonicalVariables,
      }),
    },
    options.upstreamTimeoutMs,
    options.fetchFn
  );

  const currentTimeMs = options.now();

  if (response.status === 404) {
    instanceCache.delete(validated.cacheKey);
    throw new ApiError(404, 'ANILIST_NOT_FOUND', 'The requested AniList resource was not found.', {
      expose: true,
    });
  }

  if (response.status === 429) {
    const retryAfterSeconds = parseRateLimitCooldownSeconds(
      response.headers.get('retry-after'),
      response.headers.get('x-ratelimit-reset'),
      currentTimeMs
    );
    rateLimitBlockedUntilMs = currentTimeMs + retryAfterSeconds * 1000;
    throw new ApiError(
      429,
      'ANILIST_RATE_LIMITED',
      'AniList rate limit exceeded. Please try again shortly.',
      {
        expose: true,
        retryAfterSeconds,
      }
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(
      502,
      'ANILIST_UPSTREAM_REJECTED',
      'Upstream AniList service rejected the request.',
      { expose: true }
    );
  }

  if (response.status >= 400 && response.status < 500) {
    throw new ApiError(
      400,
      'ANILIST_REQUEST_REJECTED',
      `AniList rejected the request with status ${response.status}.`,
      { expose: true }
    );
  }

  if (response.status >= 500 || !response.ok) {
    throw new ApiError(
      502,
      'ANILIST_UPSTREAM_ERROR',
      'AniList upstream service is temporarily unavailable.',
      { expose: true }
    );
  }

  const rawBody = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ApiError(502, 'ANILIST_INVALID_RESPONSE', 'AniList returned an invalid JSON payload.', {
      expose: true,
    });
  }

  inspectGraphqlPayloadOrThrow(parsed, validated, response.headers, currentTimeMs);

  // Proactively honor exhausted quota if AniList signals X-RateLimit-Remaining: 0
  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  if (remainingHeader !== null && remainingHeader.trim() === '0') {
    const resetHeader = response.headers.get('x-ratelimit-reset');
    if (resetHeader && /^\d+$/.test(resetHeader.trim())) {
      const resetEpochSeconds = Number.parseInt(resetHeader.trim(), 10);
      const deltaSeconds = Math.ceil(resetEpochSeconds - currentTimeMs / 1000);
      if (deltaSeconds > 0) {
        const clampedSeconds = Math.min(deltaSeconds, MAX_RATE_LIMIT_COOLDOWN_SECONDS);
        rateLimitBlockedUntilMs = Math.max(
          rateLimitBlockedUntilMs,
          currentTimeMs + clampedSeconds * 1000
        );
      }
    }
  }

  const entry: InstanceCacheEntry = {
    bodyText: rawBody,
    storedAt: currentTimeMs,
    policy: validated.policy,
  };
  setInstanceCacheEntry(validated.cacheKey, entry);
  return entry;
}

/**
 * Executes a validated AniList proxy request (from either GET or POST mode)
 * with server-side ANILIST_API_URL, per-instance warm memory caching,
 * in-flight deduplication, 429 cooldown protection, and safe stale fallback.
 */
export async function executeAnilistProxyRequest(
  validated: ValidatedAnilistRequest,
  options: ExecuteAnilistProxyOptions = {}
): Promise<AnilistProxyResponse> {
  const now = options.now ?? Date.now;
  const fetchFn = options.fetchFn ?? fetch;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const apiUrl = (options.getApiUrl ?? getAnilistApiUrl)();

  const currentTime = now();
  const cached = getInstanceCacheEntry(validated.cacheKey);

  // Serve from short per-instance burst cache if still fresh
  if (cached && currentTime - cached.storedAt < validated.policy.instanceFreshTtlMs) {
    return {
      statusCode: 200,
      bodyText: cached.bodyText,
      cacheControl: buildAnilistCacheControlHeader(validated.method, validated.policy),
      cachePolicy: validated.policy.category,
      cacheStatus: 'HIT',
      operation: validated.operation,
    };
  }

  const canServeStale =
    Boolean(cached) && currentTime - cached!.storedAt <= validated.policy.instanceStaleTtlMs;

  // Respect upstream 429 / exhausted quota cooldown before calling AniList again
  if (rateLimitBlockedUntilMs > currentTime) {
    if (canServeStale && cached) {
      return {
        statusCode: 200,
        bodyText: cached.bodyText,
        cacheControl: buildAnilistCacheControlHeader(validated.method, validated.policy, {
          staleFallback: true,
        }),
        cachePolicy: validated.policy.category,
        cacheStatus: 'STALE',
        operation: validated.operation,
      };
    }

    const remainingSeconds = Math.max(1, Math.ceil((rateLimitBlockedUntilMs - currentTime) / 1000));
    throw new ApiError(
      429,
      'ANILIST_RATE_LIMITED',
      'AniList rate limit exceeded. Please try again shortly.',
      {
        expose: true,
        retryAfterSeconds: remainingSeconds,
      }
    );
  }

  // Deduplicate concurrent identical requests within the same warm serverless instance
  let sharedPromise = inFlightRequests.get(validated.cacheKey);
  if (!sharedPromise) {
    sharedPromise = fetchUpstreamAnilist(validated, apiUrl, {
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
      cacheControl: buildAnilistCacheControlHeader(validated.method, validated.policy),
      cachePolicy: validated.policy.category,
      cacheStatus: 'MISS',
      operation: validated.operation,
    };
  } catch (err: unknown) {
    // Only fall back to previously valid cached data on transient failures (429 / 5xx / timeout / network).
    // Never mask 404 not found, 400 rejections, or malformed/GraphQL-error responses.
    if (canServeStale && cached && isTransientStaleEligibleError(err)) {
      return {
        statusCode: 200,
        bodyText: cached.bodyText,
        cacheControl: buildAnilistCacheControlHeader(validated.method, validated.policy, {
          staleFallback: true,
        }),
        cachePolicy: validated.policy.category,
        cacheStatus: 'STALE',
        operation: validated.operation,
      };
    }
    throw err;
  }
}
