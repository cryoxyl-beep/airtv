import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { validateAnilistGetRequest } from '../api/_lib/anilist.js';
import {
  ANILIST_MAX_SEARCH_LENGTH,
  ANILIST_SESSION_CACHE_PREFIX,
  AnilistHttpError,
  buildAnilistProxyUrl,
  clampAnilistPage,
  clampAnilistPerPage,
  fetchAnimeByGenre,
  fetchAnimeByTag,
  fetchAnimeDetails,
  fetchNewlyAddedAnime,
  fetchTop100Anime,
  fetchTopRatedAnime,
  fetchTrendingAnime,
  isTransientAnilistError,
  isValidAnilistId,
  resetAnilistClientCache,
  sanitizeAnilistGenre,
  sanitizeAnilistSearchQuery,
  sanitizeAnilistTag,
  searchAnime,
} from '../src/api/anilist.js';

const originalFetch = globalThis.fetch;

function createJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function createSampleAniListMedia(id: number, englishTitle = 'Spy x Family') {
  return {
    id,
    title: {
      romaji: 'SPY×FAMILY',
      english: englishTitle,
      native: 'SPY×FAMILY',
    },
    description: '<p>A spy on an undercover mission gets married and adopts a child.</p>',
    coverImage: {
      extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960.jpg',
      large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx140960.jpg',
      color: '#e4a15d',
    },
    bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/140960.jpg',
    averageScore: 86,
    startDate: { year: 2022, month: 4, day: 9 },
    status: 'FINISHED',
    episodes: 12,
    genres: ['Action', 'Comedy'],
    trailer: { id: 'ofXigq9aIpo', site: 'youtube' },
    relations: { edges: [] },
    streamingEpisodes: [
      {
        title: 'Episode 1 - Operation Strix',
        thumbnail: 'https://img1.ak.crunchyroll.com/i/spire1-tmb/ep1.jpg',
        url: 'https://www.crunchyroll.com/watch/1',
        site: 'Crunchyroll',
      },
    ],
  };
}

beforeEach(() => {
  resetAnilistClientCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetAnilistClientCache();
});

describe('Phase 3B: AniList Frontend Proxy URL Builder, Sorting & Input Guards', () => {
  it(' uses the v3 sessionStorage cache prefix so legacy v2 GraphQL entries are never reused', () => {
    assert.equal(ANILIST_SESSION_CACHE_PREFIX, 'anilist_v3_');
  });

  it('produces deterministic sorted query parameter ordering regardless of key insertion order', () => {
    const urlA = buildAnilistProxyUrl('topRated', { perPage: 20, page: 2 });
    const urlB = buildAnilistProxyUrl('topRated', { page: 2, perPage: 20 });

    assert.equal(urlA, '/api/anilist?op=topRated&page=2&perPage=20');
    assert.equal(urlA, urlB);

    const genreA = buildAnilistProxyUrl('byGenre', { perPage: 15, genre: 'Action' });
    const genreB = buildAnilistProxyUrl('byGenre', { genre: 'Action', perPage: 15 });
    assert.equal(genreA, '/api/anilist?genre=Action&op=byGenre&perPage=15');
    assert.equal(genreA, genreB);

    const detailsUrl = buildAnilistProxyUrl('details', { id: 140960 });
    assert.equal(detailsUrl, '/api/anilist?id=140960&op=details');
  });

  it('validates all 8 frontend operation URL shapes against backend validateAnilistGetRequest', () => {
    const operationCases: Array<{
      url: string;
      expectedOp: string;
      expectedVars: Record<string, number | string>;
    }> = [
      {
        url: buildAnilistProxyUrl('trending', { perPage: 10 }),
        expectedOp: 'trending',
        expectedVars: { perPage: 10 },
      },
      {
        url: buildAnilistProxyUrl('newlyAdded', { perPage: 10 }),
        expectedOp: 'newlyAdded',
        expectedVars: { perPage: 10 },
      },
      {
        url: buildAnilistProxyUrl('details', { id: 140960 }),
        expectedOp: 'details',
        expectedVars: { id: 140960 },
      },
      {
        url: buildAnilistProxyUrl('byGenre', { genre: 'Sci-Fi', perPage: 20 }),
        expectedOp: 'byGenre',
        expectedVars: { genre: 'Sci-Fi', perPage: 20 },
      },
      {
        url: buildAnilistProxyUrl('byTag', { perPage: 20, tag: 'Time Manipulation' }),
        expectedOp: 'byTag',
        expectedVars: { perPage: 20, tag: 'Time Manipulation' },
      },
      {
        url: buildAnilistProxyUrl('topRated', { page: 3, perPage: 20 }),
        expectedOp: 'topRated',
        expectedVars: { page: 3, perPage: 20 },
      },
      {
        url: buildAnilistProxyUrl('top100', { perPage: 30 }),
        expectedOp: 'top100',
        expectedVars: { perPage: 30 },
      },
      {
        url: buildAnilistProxyUrl('search', { perPage: 20, search: 'Attack on Titan' }),
        expectedOp: 'search',
        expectedVars: { perPage: 20, search: 'Attack on Titan' },
      },
    ];

    for (const testCase of operationCases) {
      const parsed = new URL(testCase.url, 'https://miyoro.me');
      assert.equal(parsed.pathname, '/api/anilist');
      const validated = validateAnilistGetRequest(parsed.searchParams);
      assert.equal(validated.method, 'GET');
      assert.equal(validated.operation, testCase.expectedOp);
      assert.deepEqual(validated.canonicalVariables, testCase.expectedVars);
      assert.equal(parsed.searchParams.toString(), validated.canonicalGetQueryString);
    }
  });

  it('clamps page (1..500) and perPage (1..50) to valid backend limits', () => {
    assert.equal(clampAnilistPerPage(0, 10), 1);
    assert.equal(clampAnilistPerPage(-15, 10), 1);
    assert.equal(clampAnilistPerPage(999, 10), 50);
    assert.equal(clampAnilistPerPage(25.9, 10), 25);
    assert.equal(clampAnilistPerPage(NaN, 20), 20);

    assert.equal(clampAnilistPage(0, 1), 1);
    assert.equal(clampAnilistPage(-4, 1), 1);
    assert.equal(clampAnilistPage(501, 1), 500);
    assert.equal(clampAnilistPage(4.8, 1), 4);
    assert.equal(clampAnilistPage(NaN, 1), 1);

    assert.equal(isValidAnilistId(140960), true);
    assert.equal(isValidAnilistId(0), false);
    assert.equal(isValidAnilistId(-10), false);
    assert.equal(isValidAnilistId(1.5), false);
    assert.equal(isValidAnilistId(NaN), false);
  });

  it('sanitizes search, genre, and tag inputs strictly', () => {
    assert.equal(sanitizeAnilistSearchQuery(''), null);
    assert.equal(sanitizeAnilistSearchQuery('   \t\n '), null);
    assert.equal(sanitizeAnilistSearchQuery(null), null);
    assert.equal(sanitizeAnilistSearchQuery('  Frieren\u0000\u0007  '), 'Frieren');

    const overlong = 'x'.repeat(ANILIST_MAX_SEARCH_LENGTH + 45);
    const truncated = sanitizeAnilistSearchQuery(overlong);
    assert.ok(truncated !== null);
    assert.equal(truncated.length, ANILIST_MAX_SEARCH_LENGTH);

    assert.equal(sanitizeAnilistGenre('  Sci-Fi '), 'Sci-Fi');
    assert.equal(sanitizeAnilistGenre(''), null);
    assert.equal(sanitizeAnilistGenre('Action; DROP TABLE'), null);

    assert.equal(sanitizeAnilistTag("Boys' Love"), "Boys' Love");
    assert.equal(sanitizeAnilistTag('Sci-Fi/Cyberpunk'), 'Sci-Fi/Cyberpunk');
    assert.equal(sanitizeAnilistTag('   '), null);
    assert.equal(sanitizeAnilistTag('Tag$With$Invalid$Chars'), null);
  });

  it('classifies transient vs permanent AniList HTTP errors accurately', () => {
    assert.equal(isTransientAnilistError(new AnilistHttpError(400, 'Bad Request')), false);
    assert.equal(isTransientAnilistError(new AnilistHttpError(401, 'Unauthorized')), false);
    assert.equal(isTransientAnilistError(new AnilistHttpError(403, 'Forbidden')), false);
    assert.equal(isTransientAnilistError(new AnilistHttpError(404, 'Not Found')), false);
    assert.equal(isTransientAnilistError(new AnilistHttpError(422, 'Unprocessable')), false);

    assert.equal(isTransientAnilistError(new AnilistHttpError(408, 'Timeout')), true);
    assert.equal(isTransientAnilistError(new AnilistHttpError(429, 'Rate limit')), true);
    assert.equal(isTransientAnilistError(new AnilistHttpError(500, 'Server Error')), true);
    assert.equal(isTransientAnilistError(new AnilistHttpError(502, 'Bad Gateway')), true);
    assert.equal(isTransientAnilistError(new AnilistHttpError(503, 'Unavailable')), true);
    assert.equal(isTransientAnilistError(new TypeError('Failed to fetch')), true);
  });
});

describe('Phase 3B: All 8 Frontend AniList Operations & Transport Behavior', () => {
  it('maps all 8 exported frontend functions to GET /api/anilist?op=... with zero GraphQL bodies or Authorization headers', async () => {
    const capturedCalls: Array<{
      url: string;
      method: string | undefined;
      body: unknown;
      authHeader: string | null;
    }> = [];

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      // Stub Fribb static list if preloaded during test
      if (url.includes('raw.githubusercontent.com/Fribb')) {
        return createJsonResponse([
          { anilist_id: 910001, thetvdb_id: 389597, themoviedb_id: 120089, mal_id: 50265, type: 'TV' },
        ]);
      }

      capturedCalls.push({
        url,
        method: init?.method,
        body: init?.body,
        authHeader: new Headers(init?.headers).get('authorization'),
      });

      if (url.includes('op=details')) {
        return createJsonResponse({
          data: { Media: createSampleAniListMedia(910001, 'Details Anime') },
        });
      }

      if (url.startsWith('/api/tmdb/search/multi')) {
        return createJsonResponse({
          results: [{ id: 120089, media_type: 'tv' }],
        });
      }

      if (url.startsWith('/api/tmdb/')) {
        return createJsonResponse({
          poster_path: '/tmdb-poster.jpg',
          backdrop_path: '/tmdb-backdrop.jpg',
          images: { logos: [{ iso_639_1: 'en', file_path: '/tmdb-logo.png', vote_average: 9 }] },
        });
      }

      return createJsonResponse({
        data: { Page: { media: [createSampleAniListMedia(910002, 'Catalog Anime')] } },
      });
    }) as typeof fetch;

    const trending = await fetchTrendingAnime(12, true);
    const newlyAdded = await fetchNewlyAddedAnime(8, true);
    const byGenre = await fetchAnimeByGenre('Action', 15, true);
    const byTag = await fetchAnimeByTag('Cyberpunk', 18, true);
    const topRated = await fetchTopRatedAnime(25, true, 3);
    const top100 = await fetchTop100Anime(30, true);
    const searched = await searchAnime('  Spy Family  ', 16, true);
    const details = await fetchAnimeDetails(910001);

    assert.equal(trending.results.length, 1);
    assert.equal(newlyAdded.results.length, 1);
    assert.equal(byGenre.results.length, 1);
    assert.equal(byTag.results.length, 1);
    assert.equal(topRated.results.length, 1);
    assert.equal(top100.results.length, 1);
    assert.equal(searched.results.length, 1);
    assert.ok(details);
    assert.equal(details.id, 910001);
    assert.equal(details.source, 'anilist');
    assert.equal(details.media_type, 'anime');
    assert.equal(details.overview, 'A spy on an undercover mission gets married and adopts a child.');
    assert.equal(details.anilist_raw.streamingEpisodes.length, 1);
    assert.equal(
      details.anilist_raw.streamingEpisodes[0].thumbnail,
      'https://img1.ak.crunchyroll.com/i/spire1-tmb/ep1.jpg'
    );

    const anilistCalls = capturedCalls.filter((c) => c.url.startsWith('/api/anilist'));
    assert.deepEqual(
      anilistCalls.map((c) => c.url),
      [
        '/api/anilist?op=trending&perPage=12',
        '/api/anilist?op=newlyAdded&perPage=8',
        '/api/anilist?genre=Action&op=byGenre&perPage=15',
        '/api/anilist?op=byTag&perPage=18&tag=Cyberpunk',
        '/api/anilist?op=topRated&page=3&perPage=25',
        '/api/anilist?op=top100&perPage=30',
        '/api/anilist?op=search&perPage=16&search=Spy+Family',
        '/api/anilist?id=910001&op=details',
      ]
    );

    for (const call of anilistCalls) {
      assert.equal(call.method, 'GET');
      assert.equal(call.body, undefined);
      assert.equal(call.authHeader, null);
      assert.equal(call.url.includes('graphql.anilist.co'), false);
      assert.equal(call.url.includes('query'), false);
    }

    // Also verify TMDB enrichment routed through /api/tmdb/* (Stage 3A integration preserved)
    const tmdbCalls = capturedCalls.filter((c) => c.url.startsWith('/api/tmdb/'));
    assert.ok(tmdbCalls.length >= 1);
    assert.equal(details.backdrop_path, '/tmdb-backdrop.jpg');
    assert.equal(details.logo_path, 'https://image.tmdb.org/t/p/w500/tmdb-logo.png');
  });

  it('short-circuits empty/invalid search, genre, tag, and ID inputs without issuing network calls', async () => {
    const anilistUrls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes('raw.githubusercontent.com/Fribb')) {
        return createJsonResponse([]);
      }
      anilistUrls.push(url);
      return createJsonResponse({ data: { Page: { media: [] } } });
    }) as typeof fetch;

    assert.deepEqual(await searchAnime('   ', 20, true), { results: [] });
    assert.deepEqual(await searchAnime('\u0000\u0007', 20, true), { results: [] });
    assert.deepEqual(await fetchAnimeByGenre('   ', 20, true), { results: [] });
    assert.deepEqual(await fetchAnimeByGenre('Invalid$Genre', 20, true), { results: [] });
    assert.deepEqual(await fetchAnimeByTag('', 20, true), { results: [] });
    assert.equal(await fetchAnimeDetails(0), null);
    assert.equal(await fetchAnimeDetails(-99), null);

    assert.equal(anilistUrls.length, 0);
  });

  it('clamps out-of-range page and perPage arguments before calling /api/anilist', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes('raw.githubusercontent.com/Fribb')) {
        return createJsonResponse([]);
      }
      requestedUrls.push(url);
      return createJsonResponse({ data: { Page: { media: [] } } });
    }) as typeof fetch;

    await fetchTrendingAnime(999, true);
    await fetchTopRatedAnime(0, true, 9999);

    assert.deepEqual(requestedUrls, [
      '/api/anilist?op=trending&perPage=50',
      '/api/anilist?op=topRated&page=500&perPage=1',
    ]);
  });

  it('does NOT retry permanent 400 or 404 responses and returns safe fallback', async () => {
    let attempts = 0;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes('raw.githubusercontent.com/Fribb')) {
        return createJsonResponse([]);
      }
      attempts++;
      return createJsonResponse(
        { ok: false, error: { code: 'ANILIST_NOT_FOUND', message: 'Not found' } },
        404
      );
    }) as typeof fetch;

    const result = await fetchAnimeDetails(987654321);
    assert.equal(result, null);
    assert.equal(attempts, 1);
  });

  it('rejects malformed or GraphQL-error payloads without caching them, and recovers on retry', async () => {
    let attempts = 0;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes('raw.githubusercontent.com/Fribb')) {
        return createJsonResponse([]);
      }
      attempts++;
      if (attempts === 1) {
        // Malformed payload with GraphQL errors
        return createJsonResponse({ errors: [{ message: 'Temporary upstream failure' }] }, 200);
      }
      return createJsonResponse({
        data: { Page: { media: [createSampleAniListMedia(910099, 'Recovered Anime')] } },
      });
    }) as typeof fetch;

    const res = await fetchTop100Anime(10, true);
    assert.equal(attempts, 2);
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0].title, 'Recovered Anime');
  });
});
