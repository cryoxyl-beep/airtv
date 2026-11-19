import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { beforeEach, describe, it } from 'node:test';
import tmdbHandler from '../api/tmdb.js';
import { ApiError, type ApiRequest, type ApiResponse } from '../api/_lib/http.js';
import {
  TMDB_CACHE_POLICIES,
  buildCacheControlHeader,
  executeTmdbProxyRequest,
  resetTmdbProxyState,
  validateTmdbRequest,
} from '../api/_lib/tmdb.js';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  json: () => unknown;
}

function createMockReqRes(
  url: string,
  method = 'GET',
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
  let bodyChunks: string[] = [];
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
  ) => Promise<{ status?: number; body?: unknown; headers?: Record<string, string> }> | {
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
  }
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
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

describe('TMDB Proxy — Validation, Routing, Caching & Error Handling', () => {
  beforeEach(() => {
    resetTmdbProxyState();
  });

  it('1-7. validates and proxies all supported Miyoro TMDB endpoints with exact cache policies', async () => {
    const cases = [
      {
        label: '1. Trending movies',
        path: '/api/tmdb/trending/movie/week',
        query: 'language=en-US&page=1',
        expectedUpstream: 'https://api.themoviedb.org/3/trending/movie/week?language=en-US&page=1',
        expectedPolicy: TMDB_CACHE_POLICIES.trending,
        mockPayload: { page: 1, results: [{ id: 550, title: 'Fight Club' }], total_pages: 10 },
      },
      {
        label: '2. Trending TV',
        path: '/api/tmdb/trending/tv/week',
        query: 'language=en-US&page=1',
        expectedUpstream: 'https://api.themoviedb.org/3/trending/tv/week?language=en-US&page=1',
        expectedPolicy: TMDB_CACHE_POLICIES.trending,
        mockPayload: { page: 1, results: [{ id: 1399, name: 'Game of Thrones' }], total_pages: 10 },
      },
      {
        label: '3. Popular movies',
        path: '/api/tmdb/movie/popular',
        query: 'language=en-US&page=1',
        expectedUpstream: 'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1',
        expectedPolicy: TMDB_CACHE_POLICIES.popular,
        mockPayload: { page: 1, results: [{ id: 27205, title: 'Inception' }], total_pages: 50 },
      },
      {
        label: '4. Movie details with append_to_response',
        path: '/api/tmdb/movie/550',
        query: 'append_to_response=images,credits,content_ratings,release_dates,videos',
        expectedUpstream:
          'https://api.themoviedb.org/3/movie/550?append_to_response=content_ratings%2Ccredits%2Cimages%2Crelease_dates%2Cvideos',
        expectedPolicy: TMDB_CACHE_POLICIES.details,
        mockPayload: { id: 550, title: 'Fight Club', images: { logos: [] }, credits: { cast: [] } },
      },
      {
        label: '5. TV details with season/1 append_to_response',
        path: '/api/tmdb/tv/1399',
        query: 'append_to_response=images,credits,content_ratings,release_dates,videos,season/1',
        expectedUpstream:
          'https://api.themoviedb.org/3/tv/1399?append_to_response=content_ratings%2Ccredits%2Cimages%2Crelease_dates%2Cseason%2F1%2Cvideos',
        expectedPolicy: TMDB_CACHE_POLICIES.details,
        mockPayload: { id: 1399, name: 'Game of Thrones', 'season/1': { episodes: [] } },
      },
      {
        label: '6a. Movie search with special characters (URL encoding)',
        path: '/api/tmdb/search/movie',
        query: 'query=Spider-Man%3A%20No%20Way%20Home&include_adult=false&language=en-US&page=1',
        expectedUpstream:
          'https://api.themoviedb.org/3/search/movie?include_adult=false&language=en-US&page=1&query=Spider-Man%3A+No+Way+Home',
        expectedPolicy: TMDB_CACHE_POLICIES.search,
        mockPayload: { page: 1, results: [{ id: 634649, title: 'Spider-Man: No Way Home' }] },
      },
      {
        label: '6b. TV search',
        path: '/api/tmdb/search/tv',
        query: 'query=Breaking%20Bad&include_adult=false&language=en-US&page=1',
        expectedUpstream:
          'https://api.themoviedb.org/3/search/tv?include_adult=false&language=en-US&page=1&query=Breaking+Bad',
        expectedPolicy: TMDB_CACHE_POLICIES.search,
        mockPayload: { page: 1, results: [{ id: 1396, name: 'Breaking Bad' }] },
      },
      {
        label: '7a. Person details',
        path: '/api/tmdb/person/287',
        query: 'language=en-US',
        expectedUpstream: 'https://api.themoviedb.org/3/person/287?language=en-US',
        expectedPolicy: TMDB_CACHE_POLICIES.details,
        mockPayload: { id: 287, name: 'Brad Pitt', known_for_department: 'Acting' },
      },
      {
        label: '7b. Person combined credits',
        path: '/api/tmdb/person/287/combined_credits',
        query: 'language=en-US',
        expectedUpstream: 'https://api.themoviedb.org/3/person/287/combined_credits?language=en-US',
        expectedPolicy: TMDB_CACHE_POLICIES.credits,
        mockPayload: { id: 287, cast: [{ id: 550, media_type: 'movie', title: 'Fight Club' }] },
      },
      {
        label: 'Extra: Discover TV (anime & provider filters)',
        path: '/api/tmdb/discover/tv',
        query: 'include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=16&origin_country=JP',
        expectedUpstream:
          'https://api.themoviedb.org/3/discover/tv?include_adult=false&language=en-US&origin_country=JP&page=1&sort_by=popularity.desc&with_genres=16',
        expectedPolicy: TMDB_CACHE_POLICIES.discover,
        mockPayload: { page: 1, results: [] },
      },
      {
        label: 'Extra: Genre list',
        path: '/api/tmdb/genre/movie/list',
        query: 'language=en-US',
        expectedUpstream: 'https://api.themoviedb.org/3/genre/movie/list?language=en-US',
        expectedPolicy: TMDB_CACHE_POLICIES.genres,
        mockPayload: { genres: [{ id: 28, name: 'Action' }] },
      },
      {
        label: 'Extra: TV Season 0 (Specials) & media images/videos',
        path: '/api/tmdb/tv/1399/season/0',
        query: 'language=en-US',
        expectedUpstream: 'https://api.themoviedb.org/3/tv/1399/season/0?language=en-US',
        expectedPolicy: TMDB_CACHE_POLICIES.details,
        mockPayload: { id: 3627, season_number: 0, episodes: [] },
      },
    ];

    for (const tc of cases) {
      const seenAuthHeaders: string[] = [];
      let seenUrl = '';
      const mockFetch = createJsonFetch((url, init) => {
        seenUrl = url;
        const headers = new Headers(init?.headers);
        seenAuthHeaders.push(headers.get('authorization') || '');
        return { status: 200, body: tc.mockPayload };
      });

      const validated = validateTmdbRequest(tc.path, new URLSearchParams(tc.query));
      assert.equal(validated.upstreamUrl, tc.expectedUpstream, tc.label);

      const res = await executeTmdbProxyRequest(validated, {
        fetchFn: mockFetch,
        getToken: () => 'test-secret-token-never-exposed',
      });

      assert.equal(res.statusCode, 200, tc.label);
      assert.equal(seenUrl, tc.expectedUpstream, tc.label);
      assert.equal(seenAuthHeaders[0], 'Bearer test-secret-token-never-exposed', tc.label);
      assert.deepEqual(JSON.parse(res.bodyText), tc.mockPayload, tc.label);
      assert.equal(res.cacheControl, buildCacheControlHeader(tc.expectedPolicy), tc.label);
      assert.ok(!res.bodyText.includes('test-secret-token-never-exposed'), tc.label);
    }
  });

  it('supports Vercel rewrite __tmdb_path query routing cleanly, preserving all query params & encoded paths', () => {
    const trending = validateTmdbRequest(
      '/api/tmdb',
      new URLSearchParams('__tmdb_path=trending%2Fmovie%2Fweek&page=1&language=en-US'),
      '/api/tmdb?__tmdb_path=trending%2Fmovie%2Fweek&page=1&language=en-US'
    );
    assert.equal(trending.normalizedPath, 'trending/movie/week');
    assert.equal(
      trending.upstreamUrl,
      'https://api.themoviedb.org/3/trending/movie/week?language=en-US&page=1'
    );
    assert.ok(!trending.upstreamUrl.includes('__tmdb_path'));

    const search = validateTmdbRequest(
      '/api/tmdb',
      new URLSearchParams(
        '__tmdb_path=search%2Fmovie&query=Spider-Man%3A%20No%20Way%20Home&include_adult=false&language=en-US&page=1'
      ),
      '/api/tmdb?__tmdb_path=search%2Fmovie&query=Spider-Man%3A%20No%20Way%20Home&include_adult=false&language=en-US&page=1'
    );
    assert.equal(search.normalizedPath, 'search/movie');
    assert.equal(
      search.upstreamUrl,
      'https://api.themoviedb.org/3/search/movie?include_adult=false&language=en-US&page=1&query=Spider-Man%3A+No+Way+Home'
    );

    // Deterministic canonicalization for equivalent reordered query params and append_to_response tokens
    const detA = validateTmdbRequest(
      '/api/tmdb/tv/1399',
      new URLSearchParams('language=en-US&append_to_response=videos,images,season/1,images')
    );
    const detB = validateTmdbRequest(
      '/api/tmdb/tv/1399',
      new URLSearchParams('append_to_response=season/1,images,videos&language=en-US')
    );
    assert.equal(detA.cacheKey, detB.cacheKey);
    assert.equal(detA.upstreamUrl, detB.upstreamUrl);
  });

  it('8. rejects invalid, private, and malformed endpoints strictly', async () => {
    const disallowedPaths: Array<{ url: string; expectedStatus: number }> = [
      { url: '/api/tmdb/account', expectedStatus: 404 },
      { url: '/api/tmdb/authentication/token/new', expectedStatus: 404 },
      { url: '/api/tmdb/movie/550/rating', expectedStatus: 404 },
      { url: '/api/tmdb/trending/movie/year', expectedStatus: 404 },
      { url: '/api/tmdb/movie/abc', expectedStatus: 404 },
      { url: '/api/tmdb', expectedStatus: 400 },
      { url: '/api/tmdb/', expectedStatus: 400 },
      { url: '/api/tmdb/../health', expectedStatus: 400 },
      { url: '/api/tmdb/movie/%2e%2e/account', expectedStatus: 400 },
      { url: '/api/tmdb/movie//550', expectedStatus: 400 },
      { url: '/api/tmdb/search/movie?language=en-US', expectedStatus: 400 }, // missing query
      { url: '/api/tmdb/trending/movie/week?api_key=leak', expectedStatus: 400 }, // disallowed param
      { url: '/api/tmdb/movie/550?append_to_response=account_states', expectedStatus: 400 }, // disallowed append
    ];

    for (const tc of disallowedPaths) {
      const { req, res, getResult } = createMockReqRes(tc.url, 'GET');
      await tmdbHandler(req, res);
      const result = getResult();
      assert.equal(result.statusCode, tc.expectedStatus, `Expected ${tc.expectedStatus} for ${tc.url}`);
      assert.equal(result.headers['cache-control'], 'no-store', `Error must not be cached for ${tc.url}`);
      const parsed = result.json() as { ok: boolean; error: { code: string; message: string } };
      assert.equal(parsed.ok, false);
      assert.ok(parsed.error.code);
      assert.ok(parsed.error.message);
    }
  });

  it('9. rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      const { req, res, getResult } = createMockReqRes(
        '/api/tmdb/trending/movie/week?language=en-US&page=1',
        method
      );
      await tmdbHandler(req, res);
      const result = getResult();
      assert.equal(result.statusCode, 405, `Expected 405 for ${method}`);
      assert.equal(result.headers['allow'], 'GET, OPTIONS');
      assert.equal(result.headers['cache-control'], 'no-store');
      const parsed = result.json() as { ok: boolean; error: { code: string } };
      assert.equal(parsed.ok, false);
      assert.equal(parsed.error.code, 'METHOD_NOT_ALLOWED');
    }
  });

  it('10. handles missing TMDB credentials cleanly with 503 and no-store', async () => {
    const originalToken = process.env.TMDB_API_TOKEN;
    delete process.env.TMDB_API_TOKEN;
    try {
      const { req, res, getResult } = createMockReqRes(
        '/api/tmdb/trending/movie/week?language=en-US&page=1',
        'GET'
      );
      await tmdbHandler(req, res);
      const result = getResult();
      assert.equal(result.statusCode, 503);
      assert.equal(result.headers['cache-control'], 'no-store');
      const parsed = result.json() as { ok: boolean; error: { code: string; message: string } };
      assert.equal(parsed.ok, false);
      assert.equal(parsed.error.code, 'TMDB_NOT_CONFIGURED');
    } finally {
      if (originalToken !== undefined) {
        process.env.TMDB_API_TOKEN = originalToken;
      }
    }
  });

  it('handles invalid TMDB credentials (401), not found (404), 429 rate limits, and 5xx without caching errors', async () => {
    const validated = validateTmdbRequest(
      '/api/tmdb/movie/550',
      new URLSearchParams('language=en-US')
    );

    // 401 -> 502 TMDB_AUTH_ERROR
    await assert.rejects(
      () =>
        executeTmdbProxyRequest(validated, {
          getToken: () => 'invalid-token-secret',
          fetchFn: createJsonFetch(() => ({ status: 401, body: { status_message: 'Invalid API key' } })),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 502);
        assert.equal(err.code, 'TMDB_AUTH_ERROR');
        assert.ok(!err.message.includes('invalid-token-secret'));
        return true;
      }
    );

    // 404 -> 404 TMDB_NOT_FOUND
    await assert.rejects(
      () =>
        executeTmdbProxyRequest(validated, {
          getToken: () => 'valid-token',
          fetchFn: createJsonFetch(() => ({ status: 404, body: { status_message: 'Not found' } })),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'TMDB_NOT_FOUND');
        return true;
      }
    );

    // 429 -> 429 TMDB_RATE_LIMITED with Retry-After and cooldown protection
    let upstreamCalls = 0;
    let fakeNow = 1_000_000;
    await assert.rejects(
      () =>
        executeTmdbProxyRequest(validated, {
          getToken: () => 'valid-token',
          now: () => fakeNow,
          fetchFn: createJsonFetch(() => {
            upstreamCalls++;
            return { status: 429, headers: { 'retry-after': '12' }, body: { status_message: 'Rate limit' } };
          }),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 429);
        assert.equal(err.code, 'TMDB_RATE_LIMITED');
        assert.equal(err.retryAfterSeconds, 12);
        return true;
      }
    );

    // Immediate retry during cooldown must NOT hammer upstream TMDB
    await assert.rejects(
      () =>
        executeTmdbProxyRequest(validated, {
          getToken: () => 'valid-token',
          now: () => fakeNow + 2000,
          fetchFn: createJsonFetch(() => {
            upstreamCalls++;
            return { status: 200, body: { id: 550 } };
          }),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 429);
        return true;
      }
    );
    assert.equal(upstreamCalls, 1, 'Cooldown should block redundant upstream calls during 429 window');
  });

  it('11. handles upstream timeouts gracefully with 504 UPSTREAM_TIMEOUT (no fake empty datasets)', async () => {
    const validated = validateTmdbRequest(
      '/api/tmdb/trending/movie/week',
      new URLSearchParams('language=en-US&page=1')
    );

    const hangingFetch = ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason ?? new Error('aborted'));
        });
      })) as typeof fetch;

    await assert.rejects(
      () =>
        executeTmdbProxyRequest(validated, {
          getToken: () => 'valid-token',
          upstreamTimeoutMs: 40,
          fetchFn: hangingFetch,
        }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 504);
        assert.equal(err.code, 'UPSTREAM_TIMEOUT');
        return true;
      }
    );
  });

  it('12. deduplicates in-flight requests, separates cache keys by query params, and serves safe stale fallback on 5xx', async () => {
    let upstreamCount = 0;
    let fakeNow = 2_000_000;

    const reqPage1 = validateTmdbRequest(
      '/api/tmdb/trending/movie/week',
      new URLSearchParams('language=en-US&page=1')
    );
    const reqPage2 = validateTmdbRequest(
      '/api/tmdb/trending/movie/week',
      new URLSearchParams('language=en-US&page=2')
    );
    assert.notEqual(reqPage1.cacheKey, reqPage2.cacheKey);

    const slowFetch = createJsonFetch(async (url) => {
      upstreamCount++;
      await new Promise((r) => setTimeout(r, 30));
      const page = new URL(url).searchParams.get('page');
      return { status: 200, body: { page: Number(page), results: [{ id: Number(page) * 100 }] } };
    });

    // Two concurrent identical requests should coalesce into 1 upstream fetch
    const [a, b] = await Promise.all([
      executeTmdbProxyRequest(reqPage1, {
        getToken: () => 'valid-token',
        fetchFn: slowFetch,
        now: () => fakeNow,
      }),
      executeTmdbProxyRequest(reqPage1, {
        getToken: () => 'valid-token',
        fetchFn: slowFetch,
        now: () => fakeNow,
      }),
    ]);

    assert.equal(upstreamCount, 1, 'Concurrent identical requests must be deduplicated');
    assert.equal(a.bodyText, b.bodyText);
    assert.equal(a.cacheControl, 'public, max-age=0, s-maxage=900, stale-while-revalidate=1800');

    // Different query param (?page=2) must NOT reuse page 1 cache
    const page2Res = await executeTmdbProxyRequest(reqPage2, {
      getToken: () => 'valid-token',
      fetchFn: slowFetch,
      now: () => fakeNow,
    });
    assert.equal(upstreamCount, 2);
    assert.equal((JSON.parse(page2Res.bodyText) as { page: number }).page, 2);

    // Repeated request within short burst TTL serves warm instance HIT
    const repeatRes = await executeTmdbProxyRequest(reqPage1, {
      getToken: () => 'valid-token',
      fetchFn: slowFetch,
      now: () => fakeNow + 5000,
    });
    assert.equal(repeatRes.cacheStatus, 'HIT');
    assert.equal(upstreamCount, 2);

    // After burst TTL expires, if TMDB returns 503, safe stale fallback is served with short CDN TTL
    const staleRes = await executeTmdbProxyRequest(reqPage1, {
      getToken: () => 'valid-token',
      now: () => fakeNow + 60_000,
      fetchFn: createJsonFetch(() => ({ status: 503, body: { status_message: 'Service Unavailable' } })),
    });
    assert.equal(staleRes.statusCode, 200);
    assert.equal(staleRes.cacheStatus, 'STALE');
    assert.equal(staleRes.cacheControl, 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    assert.equal((JSON.parse(staleRes.bodyText) as { page: number }).page, 1);
  });

  it('never serves stale fallback for 401/403 auth failures, 404 not found, or 400/422 rejections even with warm cache', async () => {
    const reqDetails = validateTmdbRequest('/api/tmdb/movie/550', new URLSearchParams('language=en-US'));
    let fakeNow = 5_000_000;

    const seedWarmCache = async () => {
      resetTmdbProxyState();
      const okRes = await executeTmdbProxyRequest(reqDetails, {
        getToken: () => 'valid-token',
        now: () => fakeNow,
        fetchFn: createJsonFetch(() => ({ status: 200, body: { id: 550, title: 'Fight Club' } })),
      });
      assert.equal(okRes.statusCode, 200);
    };

    const nonStaleStatuses: Array<{ upstreamStatus: number; expectedStatus: number; expectedCode: string }> = [
      { upstreamStatus: 401, expectedStatus: 502, expectedCode: 'TMDB_AUTH_ERROR' },
      { upstreamStatus: 403, expectedStatus: 502, expectedCode: 'TMDB_AUTH_ERROR' },
      { upstreamStatus: 404, expectedStatus: 404, expectedCode: 'TMDB_NOT_FOUND' },
      { upstreamStatus: 422, expectedStatus: 400, expectedCode: 'TMDB_REQUEST_REJECTED' },
    ];

    for (const tc of nonStaleStatuses) {
      await seedWarmCache();
      // Advance beyond short burst TTL (30s) into stale window
      await assert.rejects(
        () =>
          executeTmdbProxyRequest(reqDetails, {
            getToken: () => 'valid-token',
            now: () => fakeNow + 60_000,
            fetchFn: createJsonFetch(() => ({ status: tc.upstreamStatus, body: { status_message: 'error' } })),
          }),
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, tc.expectedStatus, `Upstream ${tc.upstreamStatus}`);
          assert.equal(err.code, tc.expectedCode, `Upstream ${tc.upstreamStatus}`);
          return true;
        }
      );

      // Verify 401/403/404 evicted the stale entry so a subsequent 503 cannot resurrect it
      if (tc.upstreamStatus === 401 || tc.upstreamStatus === 403 || tc.upstreamStatus === 404) {
        await assert.rejects(
          () =>
            executeTmdbProxyRequest(reqDetails, {
              getToken: () => 'valid-token',
              now: () => fakeNow + 65_000,
              fetchFn: createJsonFetch(() => ({ status: 503, body: { status_message: 'down' } })),
            }),
          (err: unknown) => {
            assert.ok(err instanceof ApiError);
            assert.equal(err.statusCode, 502);
            assert.equal(err.code, 'TMDB_UPSTREAM_ERROR');
            return true;
          }
        );
      }
    }
  });

  it('handles CORS and Vary: Origin safely without caching disallowed cross-origin errors', async () => {
    // Disallowed cross-origin request rejected with 403 and Cache-Control: no-store
    const { req, res, getResult } = createMockReqRes(
      '/api/tmdb/trending/movie/week?language=en-US&page=1',
      'GET',
      { origin: 'https://unauthorized.example.com' }
    );
    await tmdbHandler(req, res);
    const result = getResult();
    assert.equal(result.statusCode, 403);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['vary'], 'Origin');
    assert.equal(result.headers['access-control-allow-origin'], undefined);
  });
});
