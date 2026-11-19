import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { beforeEach, describe, it } from 'node:test';
import anilistHandler from '../api/anilist.js';
import healthHandler from '../api/health.js';
import {
  ANILIST_CACHE_POLICIES,
  ANILIST_MEDIA_FIELDS,
  buildAnilistCacheControlHeader,
  buildCanonicalAnilistGetQuery,
  executeAnilistProxyRequest,
  resetAnilistProxyState,
  validateAnilistGetRequest,
  validateAnilistPostRequest,
  type AnilistOperationName,
} from '../api/_lib/anilist.js';
import { ApiError, type ApiRequest, type ApiResponse } from '../api/_lib/http.js';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  json: () => unknown;
}

function createMockReqRes(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' = 'GET',
  options: {
    headers?: Record<string, string>;
    rawBody?: string;
    preParsedBody?: unknown;
  } = {}
): { req: ApiRequest; res: ApiResponse; getResult: () => MockResponseResult } {
  const emitter = new EventEmitter();
  const reqObj: Record<string, unknown> = {
    url,
    method,
    headers: {
      host: 'localhost:3000',
      ...(options.headers ?? {}),
    },
  };

  if (options.preParsedBody !== undefined) {
    reqObj.body = options.preParsedBody;
  }

  const req = Object.assign(emitter, reqObj, {
    async *[Symbol.asyncIterator]() {
      if (options.rawBody !== undefined && options.rawBody.length > 0) {
        yield Buffer.from(options.rawBody, 'utf8');
      }
    },
  }) as unknown as ApiRequest;

  const responseHeaders = new Map<string, string>();
  let statusCode = 200;
  const bodyChunks: string[] = [];
  let headersSent = false;
  let writableEnded = false;

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return writableEnded;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      responseHeaders.set(
        name.toLowerCase(),
        Array.isArray(value) ? value.join(', ') : String(value)
      );
    },
    getHeader(name: string) {
      return responseHeaders.get(name.toLowerCase());
    },
    end(chunk?: string | Buffer) {
      headersSent = true;
      writableEnded = true;
      if (chunk !== undefined) {
        bodyChunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      }
    },
  } as unknown as ApiResponse;

  return {
    req,
    res,
    getResult: () => {
      const body = bodyChunks.join('');
      return {
        statusCode,
        headers: Object.fromEntries(responseHeaders.entries()),
        body,
        json: () => JSON.parse(body),
      };
    },
  };
}

function createJsonFetch(
  responder: (
    url: string,
    init?: RequestInit
  ) =>
    | Promise<{ status?: number; body?: unknown; headers?: Record<string, string> }>
    | { status?: number; body?: unknown; headers?: Record<string, string> }
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const reply = await responder(url, init);
    const status = reply.status ?? 200;
    const payload = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body ?? {});
    return new Response(payload, {
      status,
      headers: {
        'content-type': 'application/json',
        ...(reply.headers ?? {}),
      },
    });
  }) as typeof fetch;
}

// Exact GraphQL query strings mirrored from src/api/anilist.ts
const FRONTEND_QUERIES: Record<AnilistOperationName, string> = {
  trending: `
    query ($perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, sort: TRENDING_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `,
  newlyAdded: `
    query ($perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, sort: START_DATE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `,
  details: `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        ${ANILIST_MEDIA_FIELDS}
      }
    }
  `,
  byGenre: `
    query ($genre: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, genre: $genre, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `,
  byTag: `
    query ($tag: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, tag: $tag, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `,
  topRated: `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (type: ANIME, sort: SCORE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `,
  top100: `
    query ($perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, sort: SCORE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `,
  search: `
    query ($search: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
          ${ANILIST_MEDIA_FIELDS}
        }
      }
    }
  `,
};

describe('AniList Dual-Mode Proxy — Validation, Caching, Rate Limiting & Error Handling', () => {
  beforeEach(() => {
    resetAnilistProxyState();
  });

  it('1. validates and proxies all 8 Miyoro operations via GET with exact CDN cache policies and canonical ordering', async () => {
    const cases: {
      url: string;
      expectedOp: AnilistOperationName;
      expectedCategory: keyof typeof ANILIST_CACHE_POLICIES;
      expectedVars: Record<string, string | number>;
      expectedCanonicalQuery: string;
      samplePayload: unknown;
    }[] = [
      {
        url: '/api/anilist?op=trending&perPage=15',
        expectedOp: 'trending',
        expectedCategory: 'trending',
        expectedVars: { perPage: 15 },
        expectedCanonicalQuery: 'op=trending&perPage=15',
        samplePayload: { data: { Page: { media: [{ id: 1 }] } } },
      },
      {
        url: '/api/anilist?op=newlyAdded&perPage=15',
        expectedOp: 'newlyAdded',
        expectedCategory: 'trending',
        expectedVars: { perPage: 15 },
        expectedCanonicalQuery: 'op=newlyAdded&perPage=15',
        samplePayload: { data: { Page: { media: [{ id: 2 }] } } },
      },
      {
        url: '/api/anilist?op=details&id=16498',
        expectedOp: 'details',
        expectedCategory: 'details',
        expectedVars: { id: 16498 },
        expectedCanonicalQuery: 'id=16498&op=details',
        samplePayload: { data: { Media: { id: 16498, title: { english: 'Attack on Titan' } } } },
      },
      {
        url: '/api/anilist?perPage=15&genre=Slice%20of%20Life&op=byGenre',
        expectedOp: 'byGenre',
        expectedCategory: 'catalog',
        expectedVars: { genre: 'Slice of Life', perPage: 15 },
        expectedCanonicalQuery: 'genre=Slice+of+Life&op=byGenre&perPage=15',
        samplePayload: { data: { Page: { media: [{ id: 3 }] } } },
      },
      {
        url: '/api/anilist?op=byTag&tag=Martial%20Arts&perPage=15',
        expectedOp: 'byTag',
        expectedCategory: 'catalog',
        expectedVars: { perPage: 15, tag: 'Martial Arts' },
        expectedCanonicalQuery: 'op=byTag&perPage=15&tag=Martial+Arts',
        samplePayload: { data: { Page: { media: [{ id: 4 }] } } },
      },
      {
        url: '/api/anilist?perPage=35&op=topRated&page=2',
        expectedOp: 'topRated',
        expectedCategory: 'catalog',
        expectedVars: { page: 2, perPage: 35 },
        expectedCanonicalQuery: 'op=topRated&page=2&perPage=35',
        samplePayload: { data: { Page: { media: [{ id: 5 }] } } },
      },
      {
        url: '/api/anilist?op=top100&perPage=30',
        expectedOp: 'top100',
        expectedCategory: 'catalog',
        expectedVars: { perPage: 30 },
        expectedCanonicalQuery: 'op=top100&perPage=30',
        samplePayload: { data: { Page: { media: [{ id: 6 }] } } },
      },
      {
        url: '/api/anilist?op=search&search=Frieren&perPage=20',
        expectedOp: 'search',
        expectedCategory: 'search',
        expectedVars: { perPage: 20, search: 'Frieren' },
        expectedCanonicalQuery: 'op=search&perPage=20&search=Frieren',
        samplePayload: { data: { Page: { media: [{ id: 154587 }] } } },
      },
    ];

    for (const testCase of cases) {
      const parsedUrl = new URL(testCase.url, 'https://miyoro.me');
      const validated = validateAnilistGetRequest(parsedUrl.searchParams);

      assert.equal(validated.method, 'GET');
      assert.equal(validated.operation, testCase.expectedOp);
      assert.equal(validated.policy.category, testCase.expectedCategory);
      assert.deepEqual(validated.canonicalVariables, testCase.expectedVars);
      assert.equal(validated.canonicalGetQueryString, testCase.expectedCanonicalQuery);

      let capturedMethod = '';
      let capturedUrl = '';
      let capturedBody: { query: string; variables: Record<string, unknown> } | null = null;
      let capturedAuthHeader: string | null = null;

      const mockFetch = createJsonFetch((url, init) => {
        capturedUrl = url;
        capturedMethod = init?.method || '';
        const headers = new Headers(init?.headers);
        capturedAuthHeader = headers.get('authorization');
        capturedBody = JSON.parse(String(init?.body || '{}'));
        return { status: 200, body: testCase.samplePayload };
      });

      const result = await executeAnilistProxyRequest(validated, {
        fetchFn: mockFetch,
        getApiUrl: () => 'https://graphql.anilist.co',
      });

      assert.equal(capturedUrl, 'https://graphql.anilist.co');
      assert.equal(capturedMethod, 'POST');
      assert.equal(capturedAuthHeader, null);
      assert.deepEqual(capturedBody?.variables, testCase.expectedVars);
      assert.equal(result.statusCode, 200);
      assert.equal(result.cacheStatus, 'MISS');
      assert.equal(result.cachePolicy, testCase.expectedCategory);
      assert.equal(
        result.cacheControl,
        buildAnilistCacheControlHeader('GET', ANILIST_CACHE_POLICIES[testCase.expectedCategory])
      );
      assert.deepEqual(JSON.parse(result.bodyText), testCase.samplePayload);
    }
  });

  it('2. validates and proxies all 8 Miyoro queries via POST and never emits public CDN caching headers', async () => {
    const postCases: {
      op: AnilistOperationName;
      variables: Record<string, unknown>;
      samplePayload: unknown;
    }[] = [
      { op: 'trending', variables: { perPage: 15 }, samplePayload: { data: { Page: { media: [] } } } },
      { op: 'newlyAdded', variables: { perPage: 15 }, samplePayload: { data: { Page: { media: [] } } } },
      { op: 'details', variables: { id: 113415 }, samplePayload: { data: { Media: { id: 113415 } } } },
      { op: 'byGenre', variables: { perPage: 15, genre: 'Sci-Fi' }, samplePayload: { data: { Page: { media: [] } } } },
      { op: 'byTag', variables: { perPage: 15, tag: 'Isekai' }, samplePayload: { data: { Page: { media: [] } } } },
      { op: 'topRated', variables: { perPage: 35, page: 1 }, samplePayload: { data: { Page: { media: [] } } } },
      { op: 'top100', variables: { perPage: 30 }, samplePayload: { data: { Page: { media: [] } } } },
      { op: 'search', variables: { perPage: 20, search: 'Chainsaw Man' }, samplePayload: { data: { Page: { media: [] } } } },
    ];

    for (const c of postCases) {
      const validated = validateAnilistPostRequest({
        query: FRONTEND_QUERIES[c.op],
        variables: c.variables,
      });
      assert.equal(validated.method, 'POST');
      assert.equal(validated.operation, c.op);

      const mockFetch = createJsonFetch(() => ({ status: 200, body: c.samplePayload }));
      const result = await executeAnilistProxyRequest(validated, {
        fetchFn: mockFetch,
        getApiUrl: () => 'https://graphql.anilist.co',
      });

      assert.equal(result.statusCode, 200);
      assert.equal(result.cacheControl, 'no-store');
      assert.deepEqual(JSON.parse(result.bodyText), c.samplePayload);
    }
  });

  it('3. strictly rejects mutations, subscriptions, introspection, modified queries, aliases, directives, comments, and arbitrary GraphQL', async () => {
    const rejectedQueries = [
      // Mutation
      `mutation ($id: Int) { SaveMediaListEntry(mediaId: $id) { id } }`,
      // Subscription
      `subscription { AiringNotification { id } }`,
      // Introspection
      `query { __schema { types { name } } }`,
      `query ($id: Int) { Media(id: $id, type: ANIME) { __typename id } }`,
      // Modified filter (isAdult changed to true)
      FRONTEND_QUERIES.trending.replace('isAdult: false', 'isAdult: true'),
      // Modified filter (type changed to MANGA)
      FRONTEND_QUERIES.details.replace('type: ANIME', 'type: MANGA'),
      // Extra unapproved field injected
      FRONTEND_QUERIES.details.replace('episodes', 'episodes\n nextAiringEpisode { episode }'),
      // Field alias attempt
      FRONTEND_QUERIES.details.replace('Media (id: $id, type: ANIME)', 'a: Media (id: $id, type: ANIME)'),
      // GraphQL comment injection
      `# comment\n${FRONTEND_QUERIES.trending}`,
      // Directive injection
      FRONTEND_QUERIES.trending.replace('episodes', 'episodes @include(if: true)'),
      // Fragment / spread injection
      `query ($id: Int) { Media(id: $id, type: ANIME) { ...F } } fragment F on Media { id }`,
      // Arbitrary Viewer query (private user data)
      `query { Viewer { id name } }`,
      // Arbitrary MediaListCollection query
      `query { MediaListCollection(userName: "test", type: ANIME) { lists { name } } }`,
    ];

    for (const badQuery of rejectedQueries) {
      assert.throws(
        () => validateAnilistPostRequest({ query: badQuery, variables: { id: 1, perPage: 10 } }),
        (err: unknown) => err instanceof ApiError && err.statusCode === 400,
        `Expected query to be rejected: ${badQuery.slice(0, 80)}`
      );
    }
  });

  it('4. strictly rejects unknown variables, invalid variable types/ranges, unexpected body fields, and invalid GET params', () => {
    // Unexpected POST body fields
    assert.throws(
      () =>
        validateAnilistPostRequest({
          query: FRONTEND_QUERIES.trending,
          variables: { perPage: 10 },
          operationName: 'Trending',
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY'
    );
    assert.throws(
      () =>
        validateAnilistPostRequest({
          query: FRONTEND_QUERIES.trending,
          variables: { perPage: 10 },
          extensions: { persistedQuery: {} },
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400 && err.code === 'INVALID_REQUEST_BODY'
    );
    assert.throws(
      () => validateAnilistPostRequest([]),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400
    );

    // Query params passed to POST
    assert.throws(
      () =>
        validateAnilistPostRequest(
          { query: FRONTEND_QUERIES.trending, variables: { perPage: 10 } },
          new URLSearchParams('op=trending')
        ),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400 && err.code === 'INVALID_QUERY_PARAMETER'
    );

    // Unknown variable in POST
    assert.throws(
      () =>
        validateAnilistPostRequest({
          query: FRONTEND_QUERIES.trending,
          variables: { perPage: 10, isAdult: true },
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400 && err.code === 'INVALID_VARIABLE'
    );

    // Invalid variable types & ranges in POST
    const badPostVars: [AnilistOperationName, Record<string, unknown>][] = [
      ['trending', { perPage: '10' }], // string instead of int
      ['trending', { perPage: 0 }], // below min
      ['trending', { perPage: 51 }], // above AniList max 50
      ['trending', { perPage: 10.5 }], // float
      ['details', {}], // missing required id
      ['details', { id: -5 }], // negative id
      ['byGenre', { perPage: 15 }], // missing required genre
      ['byGenre', { genre: 'Action; DROP TABLE', perPage: 15 }], // invalid chars
      ['byTag', { tag: '   ', perPage: 15 }], // empty after trim
      ['topRated', { page: 501, perPage: 20 }], // page > 500
      ['search', { search: '', perPage: 20 }], // empty search
      ['search', { search: 'a'.repeat(121), perPage: 20 }], // > 120 chars
    ];

    for (const [op, vars] of badPostVars) {
      assert.throws(
        () => validateAnilistPostRequest({ query: FRONTEND_QUERIES[op], variables: vars }),
        (err: unknown) => err instanceof ApiError && err.statusCode === 400,
        `Expected POST vars to be rejected for ${op}: ${JSON.stringify(vars)}`
      );
    }

    // Invalid GET requests (including raw query param smuggling)
    const badGetUrls = [
      '/api/anilist', // missing op
      '/api/anilist?op=unknown', // unsupported op
      '/api/anilist?op=trending&op=top100', // duplicate op
      '/api/anilist?op=trending&query=query{Viewer{id}}', // raw GraphQL rejected on GET
      '/api/anilist?op=trending&perPage=10&perPage=20', // duplicate param
      '/api/anilist?op=trending&perPage=100', // out of range
      '/api/anilist?op=trending&perPage=01', // leading zero
      '/api/anilist?op=details', // missing id
      '/api/anilist?op=details&id=abc', // non-numeric id
      '/api/anilist?op=details&id=1&extra=1', // unknown param
      '/api/anilist?op=search&search=%20%20', // blank search
    ];

    for (const badUrl of badGetUrls) {
      const parsed = new URL(badUrl, 'https://miyoro.me');
      assert.throws(
        () => validateAnilistGetRequest(parsed.searchParams),
        (err: unknown) => err instanceof ApiError && err.statusCode === 400,
        `Expected GET URL to be rejected: ${badUrl}`
      );
    }
  });

  it('5. handler rejects Authorization headers, unsupported HTTP methods, non-JSON POST, oversized payloads, and disallowed CORS origins', async () => {
    // Authorization header on GET
    {
      const { req, res, getResult } = createMockReqRes('/api/anilist?op=trending&perPage=10', 'GET', {
        headers: { authorization: 'Bearer secret-user-token' },
      });
      await anilistHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 400);
      assert.equal(out.headers['cache-control'], 'no-store');
      assert.equal((out.json() as { error: { code: string } }).error.code, 'AUTH_NOT_SUPPORTED');
    }

    // Authorization header on POST
    {
      const { req, res, getResult } = createMockReqRes('/api/anilist', 'POST', {
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer secret-user-token',
        },
        rawBody: JSON.stringify({ query: FRONTEND_QUERIES.trending, variables: { perPage: 10 } }),
      });
      await anilistHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 400);
      assert.equal((out.json() as { error: { code: string } }).error.code, 'AUTH_NOT_SUPPORTED');
    }

    // Unsupported HTTP method (DELETE)
    {
      const { req, res, getResult } = createMockReqRes('/api/anilist', 'DELETE');
      await anilistHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 405);
      assert.equal(out.headers['cache-control'], 'no-store');
      assert.equal(out.headers['allow'], 'GET, POST, OPTIONS');
    }

    // Non-JSON Content-Type on POST (even if body pre-parsed)
    {
      const { req, res, getResult } = createMockReqRes('/api/anilist', 'POST', {
        headers: { 'content-type': 'text/plain' },
        preParsedBody: JSON.stringify({ query: FRONTEND_QUERIES.trending, variables: { perPage: 10 } }),
      });
      await anilistHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 415);
      assert.equal((out.json() as { error: { code: string } }).error.code, 'UNSUPPORTED_MEDIA_TYPE');
    }

    // Oversized POST body (> 8 KB)
    {
      const hugePayload = JSON.stringify({
        query: FRONTEND_QUERIES.search,
        variables: { search: 'x'.repeat(9000), perPage: 10 },
      });
      const { req, res, getResult } = createMockReqRes('/api/anilist', 'POST', {
        headers: { 'content-type': 'application/json' },
        rawBody: hugePayload,
      });
      await anilistHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 413);
      assert.equal((out.json() as { error: { code: string } }).error.code, 'PAYLOAD_TOO_LARGE');
    }

    // Disallowed cross-origin request
    {
      const { req, res, getResult } = createMockReqRes('/api/anilist?op=trending', 'GET', {
        headers: { origin: 'https://evil.example' },
      });
      await anilistHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 403);
      assert.equal(out.headers['cache-control'], 'no-store');
      assert.equal(out.headers['vary'], 'Origin');
      assert.equal(out.headers['access-control-allow-origin'], undefined);
    }

    // Allowed same-origin OPTIONS preflight
    {
      const { req, res, getResult } = createMockReqRes('/api/anilist', 'OPTIONS', {
        headers: { origin: 'http://localhost:3000' },
      });
      await anilistHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 204);
      assert.equal(out.headers['access-control-allow-origin'], 'http://localhost:3000');
      assert.equal(out.headers['access-control-allow-methods'], 'GET, POST, OPTIONS');
    }
  });

  it('6. isolates cache keys across operations/variables, canonicalizes key order, and deduplicates in-flight requests', async () => {
    let fetchCalls = 0;
    const mockFetch = createJsonFetch(async (_url, init) => {
      fetchCalls += 1;
      const body = JSON.parse(String(init?.body || '{}'));
      await new Promise((r) => setTimeout(r, 25));
      return {
        status: 200,
        body: { data: { Page: { media: [{ id: fetchCalls, vars: body.variables }] } } },
      };
    });

    // Two concurrent GET requests with different param orders must share 1 upstream call
    const reqA = validateAnilistGetRequest(new URLSearchParams('op=byGenre&genre=Action&perPage=15'));
    const reqB = validateAnilistGetRequest(new URLSearchParams('perPage=15&op=byGenre&genre=Action'));
    assert.equal(reqA.cacheKey, reqB.cacheKey);
    assert.equal(
      buildCanonicalAnilistGetQuery('byGenre', reqA.canonicalVariables),
      'genre=Action&op=byGenre&perPage=15'
    );

    const [resA, resB] = await Promise.all([
      executeAnilistProxyRequest(reqA, { fetchFn: mockFetch, getApiUrl: () => 'https://graphql.anilist.co' }),
      executeAnilistProxyRequest(reqB, { fetchFn: mockFetch, getApiUrl: () => 'https://graphql.anilist.co' }),
    ]);

    assert.equal(fetchCalls, 1);
    assert.equal(resA.bodyText, resB.bodyText);

    // Different variable value MUST NOT share cache entry
    const reqDifferentGenre = validateAnilistGetRequest(
      new URLSearchParams('op=byGenre&genre=Horror&perPage=15')
    );
    assert.notEqual(reqDifferentGenre.cacheKey, reqA.cacheKey);
    const resHorror = await executeAnilistProxyRequest(reqDifferentGenre, {
      fetchFn: mockFetch,
      getApiUrl: () => 'https://graphql.anilist.co',
    });
    assert.equal(fetchCalls, 2);
    assert.equal(resHorror.cacheStatus, 'MISS');

    // Different perPage MUST NOT share cache entry
    const reqDifferentPerPage = validateAnilistGetRequest(
      new URLSearchParams('op=byGenre&genre=Action&perPage=20')
    );
    assert.notEqual(reqDifferentPerPage.cacheKey, reqA.cacheKey);
    await executeAnilistProxyRequest(reqDifferentPerPage, {
      fetchFn: mockFetch,
      getApiUrl: () => 'https://graphql.anilist.co',
    });
    assert.equal(fetchCalls, 3);

    // Equivalent POST request hits warm instance cache but MUST return Cache-Control: no-store
    const postEquivalent = validateAnilistPostRequest({
      query: FRONTEND_QUERIES.byGenre,
      variables: { perPage: 15, genre: 'Action' },
    });
    assert.equal(postEquivalent.cacheKey, reqA.cacheKey);
    const resPostHit = await executeAnilistProxyRequest(postEquivalent, {
      fetchFn: mockFetch,
      getApiUrl: () => 'https://graphql.anilist.co',
    });
    assert.equal(fetchCalls, 3); // no extra upstream call
    assert.equal(resPostHit.cacheStatus, 'HIT');
    assert.equal(resPostHit.cacheControl, 'no-store');
  });

  it('7. enforces 429 cooldown with Retry-After / X-RateLimit-Reset and serves stale fallback safely when warm', async () => {
    let clock = 1_000_000;
    let upstreamCalls = 0;

    // Step 1: Cold 429 fails fast with Retry-After and sets cooldown
    const reqTrending = validateAnilistGetRequest(new URLSearchParams('op=trending&perPage=10'));
    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqTrending, {
          now: () => clock,
          getApiUrl: () => 'https://graphql.anilist.co',
          fetchFn: createJsonFetch(() => {
            upstreamCalls += 1;
            return {
              status: 429,
              headers: { 'retry-after': '20' },
              body: { errors: [{ message: 'Too Many Requests.', status: 429 }] },
            };
          }),
        }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.statusCode === 429 &&
        err.code === 'ANILIST_RATE_LIMITED' &&
        err.retryAfterSeconds === 20
    );
    assert.equal(upstreamCalls, 1);

    // Step 2: During cooldown (5s later), proxy must NOT call upstream again
    clock += 5_000;
    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqTrending, {
          now: () => clock,
          getApiUrl: () => 'https://graphql.anilist.co',
          fetchFn: createJsonFetch(() => {
            upstreamCalls += 1;
            return { status: 200, body: { data: { Page: { media: [] } } } };
          }),
        }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.statusCode === 429 &&
        err.code === 'ANILIST_RATE_LIMITED' &&
        err.retryAfterSeconds === 15
    );
    assert.equal(upstreamCalls, 1);

    // Step 3: After cooldown expires, warm cache succeeds
    clock += 20_000;
    const warmPayload = { data: { Page: { media: [{ id: 16498 }] } } };
    const warmResult = await executeAnilistProxyRequest(reqTrending, {
      now: () => clock,
      getApiUrl: () => 'https://graphql.anilist.co',
      fetchFn: createJsonFetch(() => {
        upstreamCalls += 1;
        return { status: 200, body: warmPayload };
      }),
    });
    assert.equal(warmResult.cacheStatus, 'MISS');
    assert.equal(upstreamCalls, 2);

    // Step 4: After fresh TTL (30s) expires, an upstream 429 serves STALE cached payload
    clock += 60_000;
    const staleOn429 = await executeAnilistProxyRequest(reqTrending, {
      now: () => clock,
      getApiUrl: () => 'https://graphql.anilist.co',
      fetchFn: createJsonFetch(() => {
        upstreamCalls += 1;
        return { status: 429, headers: { 'retry-after': '12' }, body: {} };
      }),
    });
    assert.equal(staleOn429.cacheStatus, 'STALE');
    assert.equal(staleOn429.cacheControl, 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    assert.deepEqual(JSON.parse(staleOn429.bodyText), warmPayload);
    assert.equal(upstreamCalls, 3);

    // Step 5: Subsequent request during cooldown also serves STALE without calling upstream
    clock += 2_000;
    const staleDuringCooldown = await executeAnilistProxyRequest(reqTrending, {
      now: () => clock,
      getApiUrl: () => 'https://graphql.anilist.co',
      fetchFn: createJsonFetch(() => {
        upstreamCalls += 1;
        return { status: 200, body: {} };
      }),
    });
    assert.equal(staleDuringCooldown.cacheStatus, 'STALE');
    assert.equal(upstreamCalls, 3);
  });

  it('8. never caches errors, GraphQL error envelopes, malformed JSON, or 404s — and never serves stale on non-transient errors', async () => {
    let clock = 2_000_000;
    const reqDetails = validateAnilistGetRequest(new URLSearchParams('op=details&id=16498'));

    // Warm the cache first
    const validPayload = { data: { Media: { id: 16498 } } };
    await executeAnilistProxyRequest(reqDetails, {
      now: () => clock,
      getApiUrl: () => 'https://graphql.anilist.co',
      fetchFn: createJsonFetch(() => ({ status: 200, body: validPayload })),
    });

    // Advance past 30s fresh TTL
    clock += 60_000;

    // 5xx IS transient -> serves STALE
    const staleOn5xx = await executeAnilistProxyRequest(reqDetails, {
      now: () => clock,
      getApiUrl: () => 'https://graphql.anilist.co',
      fetchFn: createJsonFetch(() => ({ status: 503, body: 'Service Unavailable' })),
    });
    assert.equal(staleOn5xx.cacheStatus, 'STALE');
    assert.deepEqual(JSON.parse(staleOn5xx.bodyText), validPayload);

    // Upstream 200 with GraphQL errors array is NOT cached and NOT masked with stale
    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqDetails, {
          now: () => clock,
          getApiUrl: () => 'https://graphql.anilist.co',
          fetchFn: createJsonFetch(() => ({
            status: 200,
            body: { data: { Media: null }, errors: [{ message: 'Validation failed', status: 400 }] },
          })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 502 && err.code === 'ANILIST_GRAPHQL_ERROR'
    );

    // Upstream 400 rejection is NOT masked with stale
    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqDetails, {
          now: () => clock,
          getApiUrl: () => 'https://graphql.anilist.co',
          fetchFn: createJsonFetch(() => ({ status: 400, body: { errors: [{ message: 'Bad Request' }] } })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400 && err.code === 'ANILIST_REQUEST_REJECTED'
    );

    // Malformed JSON is NOT cached and NOT masked with stale
    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqDetails, {
          now: () => clock,
          getApiUrl: () => 'https://graphql.anilist.co',
          fetchFn: createJsonFetch(() => ({ status: 200, body: '<html>not-json</html>' })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 502 && err.code === 'ANILIST_INVALID_RESPONSE'
    );

    // Legitimate 404 (or GraphQL 404 Not Found) evicts cached entry and is NOT masked with stale
    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqDetails, {
          now: () => clock,
          getApiUrl: () => 'https://graphql.anilist.co',
          fetchFn: createJsonFetch(() => ({
            status: 200,
            body: { data: { Media: null }, errors: [{ message: 'Not Found.', status: 404 }] },
          })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 404 && err.code === 'ANILIST_NOT_FOUND'
    );

    // Subsequent 500 after 404 eviction MUST fail with 502 (proving 404 evicted the prior entry)
    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqDetails, {
          now: () => clock,
          getApiUrl: () => 'https://graphql.anilist.co',
          fetchFn: createJsonFetch(() => ({ status: 500, body: 'Internal Error' })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 502 && err.code === 'ANILIST_UPSTREAM_ERROR'
    );
  });

  it('9. handles upstream timeouts cleanly with 504 UPSTREAM_TIMEOUT (no fake empty datasets)', async () => {
    const reqSearch = validateAnilistGetRequest(new URLSearchParams('op=search&search=Naruto'));
    const slowFetch = ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('Aborted')));
      })) as typeof fetch;

    await assert.rejects(
      () =>
        executeAnilistProxyRequest(reqSearch, {
          fetchFn: slowFetch,
          upstreamTimeoutMs: 30,
          getApiUrl: () => 'https://graphql.anilist.co',
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 504 && err.code === 'UPSTREAM_TIMEOUT'
    );
  });

  it('10. preserves /api/health endpoint behavior', async () => {
    const { req, res, getResult } = createMockReqRes('/api/health', 'GET');
    await healthHandler(req, res);
    const out = getResult();
    assert.equal(out.statusCode, 200);
    const payload = out.json() as { ok: boolean; providers: { anilist: { configured: boolean } } };
    assert.equal(payload.ok, true);
    assert.equal(payload.providers.anilist.configured, true);
  });
});
