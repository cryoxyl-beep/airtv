import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { validateTmdbRequest } from '../api/_lib/tmdb.js';
import {
  TMDB_MAX_SEARCH_QUERY_LENGTH,
  TmdbHttpError,
  buildTmdbProxyUrl,
  canonicalizeAppendToResponse,
  isTransientTmdbError,
  isValidTmdbId,
  isValidTmdbSeasonNumber,
  sanitizeTmdbSearchQuery,
  sanitizeTmdbTitleFallbackQuery,
  tmdbProxyFetch,
} from '../src/api/tmdbProxy.js';
import {
  fetchDetails,
  fetchTVSeason,
  getCachedLogo,
  resolveLogo,
  searchMovies,
  searchTV,
} from '../src/api/tmdb.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Phase 3A: TMDB Frontend Proxy URL Builder & Guards', () => {
  it('canonicalizes append_to_response tokens deterministically', () => {
    assert.equal(
      canonicalizeAppendToResponse('images,credits,content_ratings,release_dates,videos,season/1'),
      'content_ratings,credits,images,release_dates,season/1,videos'
    );
    assert.equal(
      canonicalizeAppendToResponse(['videos', ' images ', 'credits', 'videos', '', 'release_dates']),
      'credits,images,release_dates,videos'
    );
  });

  it('produces identical deterministic query parameter ordering regardless of object key order', () => {
    const urlA = buildTmdbProxyUrl('discover/tv', {
      with_genres: 16,
      sort_by: 'popularity.desc',
      page: 1,
      origin_country: 'JP',
      language: 'en-US',
      include_adult: false,
    });
    const urlB = buildTmdbProxyUrl('/discover/tv/', {
      include_adult: false,
      language: 'en-US',
      origin_country: 'JP',
      page: 1,
      sort_by: 'popularity.desc',
      with_genres: 16,
    });

    assert.equal(
      urlA,
      '/api/tmdb/discover/tv?include_adult=false&language=en-US&origin_country=JP&page=1&sort_by=popularity.desc&with_genres=16'
    );
    assert.equal(urlA, urlB);
  });

  it('canonicalizes append_to_response automatically inside buildTmdbProxyUrl', () => {
    const url = buildTmdbProxyUrl('tv/1399', {
      append_to_response: 'images,credits,content_ratings,release_dates,videos,season/1',
    });

    assert.equal(
      url,
      '/api/tmdb/tv/1399?append_to_response=content_ratings%2Ccredits%2Cimages%2Crelease_dates%2Cseason%2F1%2Cvideos'
    );
  });

  it('omits null, undefined, and empty query values', () => {
    const url = buildTmdbProxyUrl('movie/550/images', {
      language: undefined,
      include_image_language: null,
      append_to_response: ' , ',
    });
    assert.equal(url, '/api/tmdb/movie/550/images');
  });

  it('sanitizes search queries: rejects empty/whitespace, strips control chars, truncates >200 chars', () => {
    assert.equal(sanitizeTmdbSearchQuery(''), null);
    assert.equal(sanitizeTmdbSearchQuery('   \t\n  '), null);
    assert.equal(sanitizeTmdbSearchQuery(null), null);
    assert.equal(sanitizeTmdbSearchQuery(undefined), null);
    assert.equal(sanitizeTmdbSearchQuery('  Inception\u0000\u0007  '), 'Inception');

    const overlong = 'a'.repeat(TMDB_MAX_SEARCH_QUERY_LENGTH + 50);
    const sanitized = sanitizeTmdbSearchQuery(overlong);
    assert.ok(sanitized !== null);
    assert.equal(sanitized.length, TMDB_MAX_SEARCH_QUERY_LENGTH);
  });

  it('sanitizes title fallback queries and guards symbol/non-word-only titles', () => {
    assert.equal(sanitizeTmdbTitleFallbackQuery('SPY × FAMILY'), 'SPY x FAMILY');
    assert.equal(sanitizeTmdbTitleFallbackQuery('!!! ??? ---'), null);
    assert.equal(sanitizeTmdbTitleFallbackQuery('呪術廻戦'), null);
    assert.equal(sanitizeTmdbTitleFallbackQuery(''), null);
  });

  it('validates TMDB numeric IDs and season numbers against backend bounds', () => {
    assert.equal(isValidTmdbId(550), true);
    assert.equal(isValidTmdbId('1399'), true);
    assert.equal(isValidTmdbId(0), false);
    assert.equal(isValidTmdbId(-5), false);
    assert.equal(isValidTmdbId(12.34), false);
    assert.equal(isValidTmdbId('abc'), false);
    assert.equal(isValidTmdbId(NaN), false);

    assert.equal(isValidTmdbSeasonNumber(0), true);
    assert.equal(isValidTmdbSeasonNumber(1), true);
    assert.equal(isValidTmdbSeasonNumber('12'), true);
    assert.equal(isValidTmdbSeasonNumber(-1), false);
    assert.equal(isValidTmdbSeasonNumber(1.5), false);
    assert.equal(isValidTmdbSeasonNumber('10000'), false);
  });

  it('classifies transient vs non-transient TMDB errors accurately', () => {
    // Non-transient client errors MUST NOT be retried
    assert.equal(isTransientTmdbError(new TmdbHttpError(400, 'Bad Request')), false);
    assert.equal(isTransientTmdbError(new TmdbHttpError(401, 'Unauthorized')), false);
    assert.equal(isTransientTmdbError(new TmdbHttpError(403, 'Forbidden')), false);
    assert.equal(isTransientTmdbError(new TmdbHttpError(404, 'Not Found')), false);
    assert.equal(isTransientTmdbError(new TmdbHttpError(422, 'Unprocessable')), false);

    // Transient server/rate-limit/network errors ARE safe to retry
    assert.equal(isTransientTmdbError(new TmdbHttpError(408, 'Timeout')), true);
    assert.equal(isTransientTmdbError(new TmdbHttpError(429, 'Rate limited')), true);
    assert.equal(isTransientTmdbError(new TmdbHttpError(500, 'Internal error')), true);
    assert.equal(isTransientTmdbError(new TmdbHttpError(502, 'Bad Gateway')), true);
    assert.equal(isTransientTmdbError(new TmdbHttpError(503, 'Service Unavailable')), true);
    assert.equal(isTransientTmdbError(new TmdbHttpError(504, 'Gateway Timeout')), true);
    assert.equal(isTransientTmdbError(new TypeError('Failed to fetch')), true);
  });

  it('tmdbProxyFetch issues GET /api/tmdb/* with Accept header and zero Authorization header', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return createJsonResponse({ results: [] });
    };

    const res = await tmdbProxyFetch('trending/all/day', { language: 'en-US' }, mockFetch);
    assert.equal(res.status, 200);
    assert.equal(capturedUrl, '/api/tmdb/trending/all/day?language=en-US');
    assert.equal(capturedInit?.method, 'GET');

    const headers = new Headers(capturedInit?.headers);
    assert.equal(headers.get('accept'), 'application/json');
    assert.equal(headers.get('authorization'), null);
  });

  it('every Miyoro frontend TMDB route URL passes backend validateTmdbRequest without error', () => {
    const frontendUrls = [
      buildTmdbProxyUrl('trending/all/day', { language: 'en-US' }),
      buildTmdbProxyUrl('tv/popular', { language: 'en-US', page: 1 }),
      buildTmdbProxyUrl('movie/popular', { language: 'en-US', page: 1 }),
      buildTmdbProxyUrl('tv/top_rated', { language: 'en-US', page: 1 }),
      buildTmdbProxyUrl('movie/top_rated', { language: 'en-US', page: 1 }),
      buildTmdbProxyUrl('discover/tv', {
        include_adult: false,
        language: 'en-US',
        origin_country: 'JP',
        page: 1,
        sort_by: 'popularity.desc',
        with_genres: 16,
      }),
      buildTmdbProxyUrl('discover/movie', {
        include_adult: false,
        language: 'en-US',
        page: 1,
        sort_by: 'popularity.desc',
        with_genres: 28,
      }),
      buildTmdbProxyUrl('discover/tv', {
        include_adult: false,
        language: 'en-US',
        page: 1,
        sort_by: 'popularity.desc',
        with_genres: 18,
      }),
      buildTmdbProxyUrl('discover/movie', {
        include_adult: false,
        language: 'en-US',
        page: 2,
        sort_by: 'popularity.desc',
        watch_region: 'US',
        with_watch_providers: 8,
      }),
      buildTmdbProxyUrl('discover/tv', {
        include_adult: false,
        language: 'en-US',
        page: 2,
        sort_by: 'popularity.desc',
        watch_region: 'US',
        with_watch_providers: 8,
      }),
      buildTmdbProxyUrl('movie/550', {
        append_to_response: 'images,credits,content_ratings,release_dates,videos',
      }),
      buildTmdbProxyUrl('tv/1399', {
        append_to_response: 'images,credits,content_ratings,release_dates,videos,season/1',
      }),
      buildTmdbProxyUrl('tv/1399', { append_to_response: 'images' }),
      buildTmdbProxyUrl('movie/550/images'),
      buildTmdbProxyUrl('tv/1399/images'),
      buildTmdbProxyUrl('movie/550/videos', { language: 'en-US' }),
      buildTmdbProxyUrl('tv/1399/season/1', { language: 'en-US' }),
      buildTmdbProxyUrl('watch/providers/movie', { language: 'en-US' }),
      buildTmdbProxyUrl('search/movie', {
        include_adult: false,
        language: 'en-US',
        page: 1,
        query: 'Inception',
      }),
      buildTmdbProxyUrl('search/tv', {
        include_adult: false,
        language: 'en-US',
        page: 1,
        query: 'Breaking Bad',
      }),
      buildTmdbProxyUrl('search/multi', {
        include_adult: false,
        language: 'en-US',
        query: 'SPY x FAMILY',
      }),
      buildTmdbProxyUrl('trending/person/week', { language: 'en-US', page: 1 }),
      buildTmdbProxyUrl('person/287', { language: 'en-US' }),
      buildTmdbProxyUrl('person/287/combined_credits', { language: 'en-US' }),
    ];

    for (const url of frontendUrls) {
      const parsed = new URL(url, 'https://miyoro.me');
      const validated = validateTmdbRequest(parsed.pathname, parsed.searchParams, url);
      assert.ok(validated.upstreamUrl.startsWith('https://api.themoviedb.org/3/'), `Expected valid upstream for ${url}`);
    }
  });
});

describe('Phase 3A: src/api/tmdb.ts Proxy Behavior & Safety', () => {
  it('searchMovies and searchTV short-circuit empty queries without calling fetch', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return createJsonResponse({ results: [] });
    }) as typeof fetch;

    const emptyMovie = await searchMovies('   ');
    const emptyTv = await searchTV('');
    assert.deepEqual(emptyMovie, { results: [] });
    assert.deepEqual(emptyTv, { results: [] });
    assert.equal(calls, 0);
  });

  it('searchMovies routes through /api/tmdb/search/movie with sorted params and zero Authorization header', async () => {
    const requestedUrls: string[] = [];
    const authHeaders: Array<string | null> = [];

    globalThis.fetch = (async (input, init) => {
      requestedUrls.push(String(input));
      authHeaders.push(new Headers(init?.headers).get('authorization'));
      return createJsonResponse({
        results: [{ id: 27205, title: 'Inception', genre_ids: [28, 878] }],
      });
    }) as typeof fetch;

    const data = await searchMovies('  Inception  ');
    assert.equal(data.results.length, 1);
    assert.equal(data.results[0].media_type, 'movie');
    assert.deepEqual(requestedUrls, [
      '/api/tmdb/search/movie?include_adult=false&language=en-US&page=1&query=Inception',
    ]);
    assert.deepEqual(authHeaders, [null]);
  });

  it('fetchDetails does NOT retry 404 responses', async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      return createJsonResponse({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    }) as typeof fetch;

    await assert.rejects(
      () => fetchDetails(999999901, 'movie', 2),
      (err: unknown) => err instanceof TmdbHttpError && err.status === 404
    );
    assert.equal(attempts, 1);
  });

  it('fetchDetails DOES retry transient 503 failures and succeeds when proxy recovers', async () => {
    let attempts = 0;
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input) => {
      attempts++;
      requestedUrls.push(String(input));
      if (attempts === 1) {
        return createJsonResponse({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Busy' } }, 503);
      }
      return createJsonResponse({
        id: 999999902,
        name: 'Recovery Show',
        images: { logos: [{ iso_639_1: 'en', file_path: '/logo.png', vote_average: 5 }] },
        videos: { results: [{ site: 'YouTube', type: 'Trailer', official: true, key: 'abc123' }] },
        'season/1': { season_number: 1, episodes: [] },
      });
    }) as typeof fetch;

    const details = await fetchDetails(999999902, 'tv', 2);
    assert.equal(attempts, 2);
    assert.equal(details.media_type, 'tv');
    assert.equal(details.logo_path, 'https://image.tmdb.org/t/p/w500/logo.png');
    assert.equal(
      requestedUrls[0],
      '/api/tmdb/tv/999999902?append_to_response=content_ratings%2Ccredits%2Cimages%2Crelease_dates%2Cseason%2F1%2Cvideos'
    );
  });

  it('fetchTVSeason rejects invalid negative season without network call and does not retry 404', async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      return createJsonResponse({ ok: false, error: { code: 'NOT_FOUND', message: 'Season not found' } }, 404);
    }) as typeof fetch;

    await assert.rejects(
      () => fetchTVSeason(1399, -1, 2),
      (err: unknown) => err instanceof TmdbHttpError && err.status === 400
    );
    assert.equal(attempts, 0);

    await assert.rejects(
      () => fetchTVSeason(999999903, 99, 2),
      (err: unknown) => err instanceof TmdbHttpError && err.status === 404
    );
    assert.equal(attempts, 1);
  });

  it('resolveLogo preserves curated logos, resolves TMDB logos via /api/tmdb/*, caches them, and never calls fanart.tv', async () => {
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url === '/api/tmdb/movie/888888801/images') {
        return createJsonResponse({
          logos: [{ iso_639_1: 'en', file_path: '/test-logo.png', vote_average: 9 }],
        });
      }
      return createJsonResponse({ logos: [] });
    }) as typeof fetch;

    // Curated logo hits zero network requests
    const curated = await resolveLogo({ id: 140960, title: 'SPY x FAMILY', media_type: 'anime' });
    assert.equal(curated, 'https://image.tmdb.org/t/p/w500/yNj1PfsuudXiXCpGgnMM3hE3b1P.png');
    assert.equal(requestedUrls.length, 0);

    // Uncached movie resolves via /api/tmdb/movie/{id}/images
    const item = { id: 888888801, media_type: 'movie', title: 'Test Movie' };
    const resolved = await resolveLogo(item);
    assert.equal(resolved, 'https://image.tmdb.org/t/p/w500/test-logo.png');
    assert.equal(getCachedLogo(item), 'https://image.tmdb.org/t/p/w500/test-logo.png');

    // Second call uses in-memory logo cache (no additional fetch)
    const cachedSecond = await resolveLogo(item);
    assert.equal(cachedSecond, 'https://image.tmdb.org/t/p/w500/test-logo.png');
    assert.deepEqual(requestedUrls, ['/api/tmdb/movie/888888801/images']);

    // Item with no TMDB logos checks altType via /api/tmdb/* and NEVER calls fanart.tv
    const missingItem = { id: 888888802, media_type: 'movie', title: 'No Logo Movie' };
    const missing = await resolveLogo(missingItem);
    assert.equal(missing, null);
    assert.deepEqual(requestedUrls.slice(1), [
      '/api/tmdb/movie/888888802/images',
      '/api/tmdb/tv/888888802/images',
    ]);
    assert.equal(
      requestedUrls.some((u) => u.includes('fanart.tv') || u.includes('api.themoviedb.org')),
      false
    );
  });
});
