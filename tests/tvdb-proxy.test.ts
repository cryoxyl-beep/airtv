import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { beforeEach, describe, it } from 'node:test';
import healthHandler from '../api/health.js';
import tvdbHandler from '../api/tvdb.js';
import { ApiError, type ApiRequest, type ApiResponse } from '../api/_lib/http.js';
import {
  TVDB_CACHE_POLICIES,
  buildCanonicalTvdbGetQuery,
  buildTvdbCacheControlHeader,
  executeTvdbProxyRequest,
  extractJwtExpiryMs,
  resetTvdbProxyState,
  validateTvdbRequest,
} from '../api/_lib/tvdb.js';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  json: () => unknown;
}

function makeFakeJwt(expEpochSeconds: number, sub = 'test-tvdb-jwt'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub, exp: expEpochSeconds })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

function createMockReqRes(
  url: string,
  method: 'GET' | 'POST' | 'DELETE' | 'OPTIONS' = 'GET',
  headers: Record<string, string> = {}
): { req: ApiRequest; res: ApiResponse; getResult: () => MockResponseResult } {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    headers: {
      host: 'localhost:3000',
      ...headers,
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

const SAMPLE_TVDB_EPISODES_RESPONSE = {
  status: 'success',
  data: {
    series: { id: 267440, name: 'Attack on Titan' },
    episodes: [
      {
        id: 4512345,
        seasonNumber: 1,
        number: 1,
        absoluteNumber: 1,
        name: 'To You, 2,000 Years in the Future',
        overview: 'After 100 years of peace, humanity is reminded of the terror at their mercy.',
        image: 'https://artworks.thetvdb.com/banners/episodes/267440/4512345.jpg',
        aired: '2013-04-07',
      },
      {
        id: 4512346,
        seasonNumber: 1,
        number: 2,
        absoluteNumber: 2,
        name: 'That Day',
        overview: 'Relative path artwork sample',
        image: '/banners/episodes/267440/4512346.jpg',
        aired: '2013-04-14',
      },
    ],
  },
  links: {
    prev: null,
    self: 'https://api4.thetvdb.com/v4/series/267440/episodes/default/eng?page=0',
    next: null,
    total_items: 94,
    page_size: 500,
  },
};

describe('TVDB Proxy — Auth, Bounded Deadlines, Validation, Caching & Error Handling', () => {
  beforeEach(() => {
    resetTvdbProxyState();
  });

  it('1. validates GET query parameters strictly and builds canonical URLs/cache keys', () => {
    const validatedDefault = validateTvdbRequest(
      new URLSearchParams('seriesId=267440&op=seriesEpisodes')
    );
    assert.equal(validatedDefault.operation, 'seriesEpisodes');
    assert.equal(validatedDefault.seriesId, 267440);
    assert.equal(validatedDefault.page, 0);
    assert.equal(validatedDefault.seasonType, 'default');
    assert.equal(validatedDefault.lang, 'eng');
    assert.equal(
      validatedDefault.upstreamUrl,
      'https://api4.thetvdb.com/v4/series/267440/episodes/default/eng?page=0'
    );
    assert.equal(
      validatedDefault.canonicalQueryString,
      buildCanonicalTvdbGetQuery({
        operation: 'seriesEpisodes',
        seriesId: 267440,
        seasonType: 'default',
        lang: 'eng',
        page: 0,
      })
    );

    // Multi-page (page=1 and page=2) with different parameter ordering
    const page1A = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=81797&page=1'));
    const page1B = validateTvdbRequest(
      new URLSearchParams('page=1&lang=eng&seasonType=default&seriesId=81797&op=seriesEpisodes')
    );
    assert.equal(page1A.cacheKey, page1B.cacheKey);
    assert.equal(
      page1A.upstreamUrl,
      'https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=1'
    );

    const page2 = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=81797&page=2'));
    assert.notEqual(page1A.cacheKey, page2.cacheKey);

    // Reject invalid params, unknown ops, bad IDs, traversal, out-of-range pages, duplicates
    const badQueries = [
      '',
      'seriesId=267440', // missing op
      'op=login&seriesId=267440', // disallowed op
      'op=seriesEpisodes', // missing seriesId
      'op=seriesEpisodes&seriesId=0',
      'op=seriesEpisodes&seriesId=-10',
      'op=seriesEpisodes&seriesId=0123', // leading zero
      'op=seriesEpisodes&seriesId=12.5',
      'op=seriesEpisodes&seriesId=../login',
      'op=seriesEpisodes&seriesId=267440&page=-1',
      'op=seriesEpisodes&seriesId=267440&page=3', // above cap 2
      'op=seriesEpisodes&seriesId=267440&page=01',
      'op=seriesEpisodes&seriesId=267440&seasonType=absolute',
      'op=seriesEpisodes&seriesId=267440&lang=jpn',
      'op=seriesEpisodes&seriesId=267440&seriesId=123', // duplicate
      'op=seriesEpisodes&seriesId=267440&apikey=leak', // unknown param
    ];

    for (const qs of badQueries) {
      assert.throws(
        () => validateTvdbRequest(new URLSearchParams(qs)),
        (err: unknown) => err instanceof ApiError && err.statusCode === 400,
        `Expected query "${qs}" to be rejected`
      );
    }
  });

  it('2. authenticates server-side via /v4/login, caches JWT across requests, preserves TVDB artwork paths verbatim, and never leaks credentials', async () => {
    const nowMs = 1_700_000_000_000;
    const fakeSecretKey = 'server-only-test-api-key-value';
    const fakeJwt = makeFakeJwt(Math.floor(nowMs / 1000) + 3600);
    let loginCalls = 0;
    let episodeCalls = 0;

    const mockFetch = createJsonFetch((url, init) => {
      if (url.endsWith('/login')) {
        loginCalls += 1;
        assert.equal(init?.method, 'POST');
        assert.deepEqual(JSON.parse(String(init?.body)), { apikey: fakeSecretKey });
        return { status: 200, body: { status: 'success', data: { token: fakeJwt } } };
      }
      episodeCalls += 1;
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('authorization'), `Bearer ${fakeJwt}`);
      return { status: 200, body: SAMPLE_TVDB_EPISODES_RESPONSE };
    });

    const req1 = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=267440&page=0'));
    const res1 = await executeTvdbProxyRequest(req1, {
      fetchFn: mockFetch,
      getApiKey: () => fakeSecretKey,
      now: () => nowMs,
    });

    assert.equal(loginCalls, 1);
    assert.equal(episodeCalls, 1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.cacheStatus, 'MISS');
    assert.equal(
      res1.cacheControl,
      buildTvdbCacheControlHeader(TVDB_CACHE_POLICIES.episodes)
    );

    // Ensure TVDB episode artwork paths (both absolute URL and relative path) are preserved verbatim
    const parsed = JSON.parse(res1.bodyText);
    assert.equal(
      parsed.data.episodes[0].image,
      'https://artworks.thetvdb.com/banners/episodes/267440/4512345.jpg'
    );
    assert.equal(parsed.data.episodes[1].image, '/banners/episodes/267440/4512346.jpg');
    assert.ok(!res1.bodyText.includes(fakeSecretKey));
    assert.ok(!res1.bodyText.includes(fakeJwt));

    // Different seriesId reuses the cached JWT (no second /login call)
    const req2 = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=388339&page=0'));
    const res2 = await executeTvdbProxyRequest(req2, {
      fetchFn: mockFetch,
      getApiKey: () => fakeSecretKey,
      now: () => nowMs + 10_000,
    });
    assert.equal(loginCalls, 1);
    assert.equal(episodeCalls, 2);
    assert.equal(res2.cacheStatus, 'MISS');
  });

  it('3. deduplicates concurrent /v4/login calls on cold start and concurrent identical episode fetches', async () => {
    const nowMs = 1_700_000_000_000;
    const fakeJwt = makeFakeJwt(Math.floor(nowMs / 1000) + 3600);
    let loginCalls = 0;
    let episodeCalls = 0;

    const mockFetch = createJsonFetch(async (url) => {
      await new Promise((r) => setTimeout(r, 20));
      if (url.endsWith('/login')) {
        loginCalls += 1;
        return { status: 200, body: { status: 'success', data: { token: fakeJwt } } };
      }
      episodeCalls += 1;
      return { status: 200, body: SAMPLE_TVDB_EPISODES_RESPONSE };
    });

    const reqA = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=267440&page=0'));
    const reqB = validateTvdbRequest(new URLSearchParams('page=0&seriesId=267440&op=seriesEpisodes'));
    const reqC = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=81797&page=0'));

    const [resA, resB, resC] = await Promise.all([
      executeTvdbProxyRequest(reqA, { fetchFn: mockFetch, getApiKey: () => 'k', now: () => nowMs }),
      executeTvdbProxyRequest(reqB, { fetchFn: mockFetch, getApiKey: () => 'k', now: () => nowMs }),
      executeTvdbProxyRequest(reqC, { fetchFn: mockFetch, getApiKey: () => 'k', now: () => nowMs }),
    ]);

    assert.equal(loginCalls, 1); // Cold burst shares 1 login
    assert.equal(episodeCalls, 2); // reqA+reqB deduplicated; reqC separate
    assert.equal(resA.bodyText, resB.bodyText);
    assert.equal(resC.statusCode, 200);
  });

  it('4. refreshes expired JWT proactively before expiry skew and recovers from a single 401 within deadline', async () => {
    let clock = 1_700_000_000_000;
    const shortLivedJwt = makeFakeJwt(Math.floor(clock / 1000) + 600, 'jwt-1'); // expires in 10m
    const refreshedJwt = makeFakeJwt(Math.floor(clock / 1000) + 7200, 'jwt-2');
    const thirdJwt = makeFakeJwt(Math.floor(clock / 1000) + 10800, 'jwt-3');

    assert.equal(extractJwtExpiryMs(shortLivedJwt, clock), (Math.floor(clock / 1000) + 600) * 1000);

    let loginCount = 0;
    let failFirstWith401 = false;

    const mockFetch = createJsonFetch((url, init) => {
      if (url.endsWith('/login')) {
        loginCount += 1;
        const token = loginCount === 1 ? shortLivedJwt : loginCount === 2 ? refreshedJwt : thirdJwt;
        return { status: 200, body: { status: 'success', data: { token } } };
      }
      const auth = new Headers(init?.headers).get('authorization');
      if (failFirstWith401 && auth === `Bearer ${refreshedJwt}`) {
        failFirstWith401 = false;
        return { status: 401, body: { status: 'failure', message: 'Unauthorized' } };
      }
      return { status: 200, body: SAMPLE_TVDB_EPISODES_RESPONSE };
    });

    // Initial login gets jwt-1
    await executeTvdbProxyRequest(
      validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=267440&page=0')),
      { fetchFn: mockFetch, getApiKey: () => 'k', now: () => clock }
    );
    assert.equal(loginCount, 1);

    // Advance 6 minutes (inside 5-minute refresh skew of 10-minute token) -> proactive refresh to jwt-2
    clock += 6 * 60 * 1000;
    await executeTvdbProxyRequest(
      validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=388339&page=0')),
      { fetchFn: mockFetch, getApiKey: () => 'k', now: () => clock }
    );
    assert.equal(loginCount, 2);

    // Simulate revoked jwt-2 returning 401 -> single refresh to jwt-3 and retry succeeds with 200
    failFirstWith401 = true;
    const resAfter401 = await executeTvdbProxyRequest(
      validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=79169&page=0')),
      { fetchFn: mockFetch, getApiKey: () => 'k', now: () => clock }
    );
    assert.equal(loginCount, 3);
    assert.equal(resAfter401.statusCode, 200);
  });

  it('5. enforces bounded overall request deadline, including skipping 401 retry when remaining budget is insufficient', async () => {
    let clock = 1_700_000_000_000;
    const jwt1 = makeFakeJwt(Math.floor(clock / 1000) + 3600, 'jwt-1');
    let loginCalls = 0;
    let dataCalls = 0;

    // Warm valid token first
    await executeTvdbProxyRequest(
      validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=267440&page=0')),
      {
        getApiKey: () => 'k',
        now: () => clock,
        fetchFn: createJsonFetch((url) => {
          if (url.endsWith('/login')) {
            loginCalls += 1;
            return { status: 200, body: { status: 'success', data: { token: jwt1 } } };
          }
          return { status: 200, body: SAMPLE_TVDB_EPISODES_RESPONSE };
        }),
      }
    );
    assert.equal(loginCalls, 1);

    // Now simulate a 401 response that consumed 7000ms of an 8500ms budget (only 1500ms left < 2200ms needed for login+retry)
    await assert.rejects(
      () =>
        executeTvdbProxyRequest(
          validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=403816&page=0')),
          {
            overallBudgetMs: 8500,
            getApiKey: () => 'k',
            now: () => clock,
            fetchFn: createJsonFetch((url) => {
              if (url.endsWith('/login')) {
                loginCalls += 1;
                return { status: 200, body: { status: 'success', data: { token: jwt1 } } };
              }
              dataCalls += 1;
              clock += 7000; // Consumed 7s before 401 arrived
              return { status: 401, body: { status: 'failure' } };
            }),
          }
        ),
      (err: unknown) => err instanceof ApiError && err.statusCode === 504 && err.code === 'UPSTREAM_TIMEOUT'
    );
    // Must NOT have started a doomed login refresh
    assert.equal(loginCalls, 1);
    assert.equal(dataCalls, 1);

    // Also verify slow hanging upstream is aborted by overall budget
    resetTvdbProxyState();
    const hangingFetch = ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason ?? new Error('Aborted'))
        );
      })) as typeof fetch;

    await assert.rejects(
      () =>
        executeTvdbProxyRequest(
          validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=267440&page=0')),
          {
            overallBudgetMs: 60,
            getApiKey: () => 'k',
            fetchFn: hangingFetch,
          }
        ),
      (err: unknown) => err instanceof ApiError && err.statusCode === 504 && err.code === 'UPSTREAM_TIMEOUT'
    );
  });

  it('6. never caches empty valid episode lists in long-lived CDN or warm instance caches', async () => {
    const nowMs = 1_700_000_000_000;
    const jwt = makeFakeJwt(Math.floor(nowMs / 1000) + 3600);
    let dataCalls = 0;

    const mockFetch = createJsonFetch((url) => {
      if (url.endsWith('/login')) {
        return { status: 200, body: { status: 'success', data: { token: jwt } } };
      }
      dataCalls += 1;
      return {
        status: 200,
        body: { status: 'success', data: { series: { id: 555 }, episodes: [] }, links: {} },
      };
    });

    const req = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=555&page=0'));
    const res1 = await executeTvdbProxyRequest(req, {
      fetchFn: mockFetch,
      getApiKey: () => 'k',
      now: () => nowMs,
    });
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.cacheControl, 'no-store');
    assert.equal(res1.cacheStatus, 'BYPASS');

    // Immediate second call must NOT hit warm instance cache
    await executeTvdbProxyRequest(req, {
      fetchFn: mockFetch,
      getApiKey: () => 'k',
      now: () => nowMs + 1000,
    });
    assert.equal(dataCalls, 2);
  });

  it('7. enforces 429 cooldown with Retry-After, serves stale fallback on transient errors only, and never masks 401/404/invalid JSON', async () => {
    let clock = 1_700_000_000_000;
    const jwt = makeFakeJwt(Math.floor(clock / 1000) + 7200);
    let dataCalls = 0;

    const req = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=267440&page=0'));

    // Warm valid non-empty cache first
    await executeTvdbProxyRequest(req, {
      now: () => clock,
      getApiKey: () => 'k',
      fetchFn: createJsonFetch((url) => {
        if (url.endsWith('/login')) return { status: 200, body: { data: { token: jwt } } };
        dataCalls += 1;
        return { status: 200, body: SAMPLE_TVDB_EPISODES_RESPONSE };
      }),
    });
    assert.equal(dataCalls, 1);

    // Advance past 30s fresh TTL
    clock += 60_000;

    // 429 triggers cooldown AND serves STALE warm payload
    const stale429 = await executeTvdbProxyRequest(req, {
      now: () => clock,
      getApiKey: () => 'k',
      fetchFn: createJsonFetch((url) => {
        if (url.endsWith('/login')) return { status: 200, body: { data: { token: jwt } } };
        dataCalls += 1;
        return { status: 429, headers: { 'retry-after': '20' }, body: {} };
      }),
    });
    assert.equal(stale429.cacheStatus, 'STALE');
    assert.equal(stale429.cacheControl, 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    assert.equal(dataCalls, 2);

    // Cold series during cooldown fails fast with 429 + Retry-After without hitting upstream
    clock += 5_000;
    const coldReq = validateTvdbRequest(new URLSearchParams('op=seriesEpisodes&seriesId=999&page=0'));
    await assert.rejects(
      () =>
        executeTvdbProxyRequest(coldReq, {
          now: () => clock,
          getApiKey: () => 'k',
          fetchFn: createJsonFetch(() => {
            dataCalls += 1;
            return { status: 200, body: SAMPLE_TVDB_EPISODES_RESPONSE };
          }),
        }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.statusCode === 429 &&
        err.code === 'TVDB_RATE_LIMITED' &&
        err.retryAfterSeconds === 15
    );
    assert.equal(dataCalls, 2);

    // After cooldown expires: 5xx serves STALE
    clock += 20_000;
    const stale5xx = await executeTvdbProxyRequest(req, {
      now: () => clock,
      getApiKey: () => 'k',
      fetchFn: createJsonFetch(() => ({ status: 503, body: 'Down' })),
    });
    assert.equal(stale5xx.cacheStatus, 'STALE');

    // Malformed JSON is NEVER masked with stale
    await assert.rejects(
      () =>
        executeTvdbProxyRequest(req, {
          now: () => clock,
          getApiKey: () => 'k',
          fetchFn: createJsonFetch(() => ({ status: 200, body: '<html>error</html>' })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 502 && err.code === 'TVDB_INVALID_RESPONSE'
    );

    // Persistent 401/403 auth failure evicts cache and is NEVER masked with stale
    await assert.rejects(
      () =>
        executeTvdbProxyRequest(req, {
          now: () => clock,
          getApiKey: () => 'k',
          fetchFn: createJsonFetch(() => ({ status: 403, body: { message: 'Forbidden' } })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 502 && err.code === 'TVDB_AUTH_ERROR'
    );

    // Re-warm and verify 404 evicts cache and never masks with stale
    await executeTvdbProxyRequest(req, {
      now: () => clock,
      getApiKey: () => 'k',
      fetchFn: createJsonFetch((url) => {
        if (url.endsWith('/login')) return { status: 200, body: { data: { token: jwt } } };
        return { status: 200, body: SAMPLE_TVDB_EPISODES_RESPONSE };
      }),
    });
    clock += 60_000;
    await assert.rejects(
      () =>
        executeTvdbProxyRequest(req, {
          now: () => clock,
          getApiKey: () => 'k',
          fetchFn: createJsonFetch(() => ({ status: 404, body: { status: 'failure' } })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 404 && err.code === 'TVDB_NOT_FOUND'
    );
    // Subsequent 500 proves 404 evicted cache (must throw 502, not serve STALE)
    await assert.rejects(
      () =>
        executeTvdbProxyRequest(req, {
          now: () => clock,
          getApiKey: () => 'k',
          fetchFn: createJsonFetch(() => ({ status: 500, body: 'err' })),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 502 && err.code === 'TVDB_UPSTREAM_ERROR'
    );
  });

  it('8. handles missing TVDB_API_KEY (503), Authorization header rejection (400), unsupported methods (405), CORS, and /api/health', async () => {
    // Missing server credential returns 503 no-store
    const prevKey = process.env.TVDB_API_KEY;
    delete process.env.TVDB_API_KEY;
    try {
      const { req, res, getResult } = createMockReqRes(
        '/api/tvdb?op=seriesEpisodes&seriesId=267440',
        'GET'
      );
      await tvdbHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 503);
      assert.equal(out.headers['cache-control'], 'no-store');
      assert.equal((out.json() as { error: { code: string } }).error.code, 'TVDB_NOT_CONFIGURED');
    } finally {
      if (prevKey !== undefined) {
        process.env.TVDB_API_KEY = prevKey;
      }
    }

    // Reject client Authorization header
    {
      const { req, res, getResult } = createMockReqRes(
        '/api/tvdb?op=seriesEpisodes&seriesId=267440',
        'GET',
        { authorization: 'Bearer client-token' }
      );
      await tvdbHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 400);
      assert.equal(out.headers['cache-control'], 'no-store');
      assert.equal((out.json() as { error: { code: string } }).error.code, 'AUTH_NOT_SUPPORTED');
    }

    // Reject POST method
    {
      const { req, res, getResult } = createMockReqRes('/api/tvdb', 'POST');
      await tvdbHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 405);
      assert.equal(out.headers['allow'], 'GET, OPTIONS');
      assert.equal(out.headers['cache-control'], 'no-store');
    }

    // Reject disallowed CORS origin
    {
      const { req, res, getResult } = createMockReqRes(
        '/api/tvdb?op=seriesEpisodes&seriesId=267440',
        'GET',
        { origin: 'https://evil.example' }
      );
      await tvdbHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 403);
      assert.equal(out.headers['cache-control'], 'no-store');
      assert.equal(out.headers['vary'], 'Origin');
    }

    // Preserve /api/health
    {
      const { req, res, getResult } = createMockReqRes('/api/health', 'GET');
      await healthHandler(req, res);
      const out = getResult();
      assert.equal(out.statusCode, 200);
      const parsed = out.json() as { ok: boolean; providers: { tvdb: { configured: boolean } } };
      assert.equal(parsed.ok, true);
      assert.equal(typeof parsed.providers.tvdb.configured, 'boolean');
    }
  });
});
