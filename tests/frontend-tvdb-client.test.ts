import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { validateTvdbRequest } from '../api/_lib/tvdb.js';
import { buildAnimeEpisodeList } from '../src/api/animeResolver.js';
import {
  TVDB_EPISODES_CACHE_PREFIX,
  buildTvdbProxyUrl,
  deduplicateTvdbEpisodes,
  fetchTVDBEpisodesForSeries,
  isValidTvdbPage,
  isValidTvdbSeriesId,
  resetTvdbClientCache,
  shouldFetchNextTvdbPage,
} from '../src/api/tvdb.js';

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as any).window;
const originalSessionStorage = (globalThis as any).sessionStorage;

function createMockSessionStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  resetTvdbClientCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as any).window = originalWindow;
  (globalThis as any).sessionStorage = originalSessionStorage;
  resetTvdbClientCache();
});

describe('Phase 3C: TVDB Frontend Proxy URL Builder & Contract Validation', () => {
  it('constructs deterministic sorted GET /api/tvdb URLs matching backend validateTvdbRequest', () => {
    const url0 = buildTvdbProxyUrl(389597, 0);
    const url1 = buildTvdbProxyUrl(81797, 1);
    const url2 = buildTvdbProxyUrl(81797, 2);

    assert.equal(url0, '/api/tvdb?lang=eng&op=seriesEpisodes&page=0&seasonType=default&seriesId=389597');
    assert.equal(url1, '/api/tvdb?lang=eng&op=seriesEpisodes&page=1&seasonType=default&seriesId=81797');
    assert.equal(url2, '/api/tvdb?lang=eng&op=seriesEpisodes&page=2&seasonType=default&seriesId=81797');

    for (const url of [url0, url1, url2]) {
      const parsed = new URL(url, 'https://miyoro.me');
      assert.equal(parsed.pathname, '/api/tvdb');
      const validated = validateTvdbRequest(parsed.searchParams);
      assert.equal(validated.operation, 'seriesEpisodes');
      assert.equal(validated.lang, 'eng');
      assert.equal(validated.seasonType, 'default');
      assert.equal(parsed.searchParams.toString(), validated.canonicalQueryString);
    }
  });

  it('validates TVDB series IDs and page bounds (0..2)', () => {
    assert.equal(isValidTvdbSeriesId(267440), true);
    assert.equal(isValidTvdbSeriesId(0), false);
    assert.equal(isValidTvdbSeriesId(-5), false);
    assert.equal(isValidTvdbSeriesId(1.5), false);
    assert.equal(isValidTvdbSeriesId(NaN), false);

    assert.equal(isValidTvdbPage(0), true);
    assert.equal(isValidTvdbPage(1), true);
    assert.equal(isValidTvdbPage(2), true);
    assert.equal(isValidTvdbPage(3), false);
    assert.equal(isValidTvdbPage(-1), false);
  });

  it('evaluates pagination rules accurately without relying on links.last', () => {
    // 1. Single page (e.g. Attack on Titan: total_items=131, page_size=500, next=null) -> do NOT fetch page 1
    assert.equal(
      shouldFetchNextTvdbPage(0, {
        prev: null,
        self: 'https://api4.thetvdb.com/v4/series/267440/episodes/default/eng?page=0',
        next: null,
        total_items: 131,
        page_size: 500,
      }),
      false
    );

    // 2. Two pages (total_items=750, page_size=500, next='...?page=1') -> fetch page 1 from page 0, stop at page 1
    assert.equal(
      shouldFetchNextTvdbPage(0, {
        next: 'https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=1',
        total_items: 750,
        page_size: 500,
      }),
      true
    );
    assert.equal(
      shouldFetchNextTvdbPage(1, {
        next: null,
        total_items: 750,
        page_size: 500,
      }),
      false
    );
    // Even if upstream erroneously returned a non-null next on page 1 when total_items=750, total/page_size stops it
    assert.equal(
      shouldFetchNextTvdbPage(1, {
        next: 'https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=2',
        total_items: 750,
        page_size: 500,
      }),
      false
    );

    // 3. Three or more pages (total_items=1150, page_size=500) -> fetch page 1, then page 2, then cap at page 2
    assert.equal(
      shouldFetchNextTvdbPage(0, {
        next: 'https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=1',
        total_items: 1150,
        page_size: 500,
      }),
      true
    );
    assert.equal(
      shouldFetchNextTvdbPage(1, {
        next: 'https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=2',
        total_items: 1150,
        page_size: 500,
      }),
      true
    );
    // Page 2 is the backend maximum (0..2); never request page 3 even if links.next exists
    assert.equal(
      shouldFetchNextTvdbPage(2, {
        next: 'https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=3',
        total_items: 1800,
        page_size: 500,
      }),
      false
    );

    // 4. Missing or malformed total_items/page_size falls back safely to links.next within 0..2 cap
    assert.equal(shouldFetchNextTvdbPage(0, null), false);
    assert.equal(shouldFetchNextTvdbPage(0, { next: '' }), false);
    assert.equal(
      shouldFetchNextTvdbPage(0, { next: 'https://api4.thetvdb.com/v4/series/1/episodes?page=1', total_items: 'invalid' }),
      true
    );
  });

  it('deduplicates episodes across pages while preserving original order', () => {
    const raw = [
      { id: 101, seasonNumber: 1, number: 1, name: 'Ep 1' },
      { id: 102, seasonNumber: 1, number: 2, name: 'Ep 2' },
      { id: 102, seasonNumber: 1, number: 2, name: 'Ep 2 Duplicate' },
      { id: 103, seasonNumber: 1, number: 3, name: 'Ep 3' },
    ];
    const deduped = deduplicateTvdbEpisodes(raw);
    assert.deepEqual(
      deduped.map((e) => e.name),
      ['Ep 1', 'Ep 2', 'Ep 3']
    );
  });
});

describe('Phase 3C: TVDB Transport, Sequential Multi-Page Fetching & Cache Safety', () => {
  it('requests only page 0 when links.next is null, with zero direct TVDB login or Authorization headers', async () => {
    const mockStorage = createMockSessionStorage();
    (globalThis as any).window = { sessionStorage: mockStorage };
    (globalThis as any).sessionStorage = mockStorage;

    const calls: Array<{ url: string; auth: string | null }> = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        auth: new Headers(init?.headers).get('authorization'),
      });
      return createJsonResponse({
        status: 'success',
        data: {
          episodes: [
            { id: 1, seasonNumber: 1, number: 1, absoluteNumber: 1, name: 'Ep 1', image: '/banners/ep1.jpg' },
          ],
        },
        links: {
          prev: null,
          self: 'https://api4.thetvdb.com/v4/series/389597/episodes/default/eng?page=0',
          next: null,
          total_items: 12,
          page_size: 500,
        },
      });
    }) as typeof fetch;

    const episodes = await fetchTVDBEpisodesForSeries(389597);
    assert.equal(episodes.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/tvdb?lang=eng&op=seriesEpisodes&page=0&seasonType=default&seriesId=389597');
    assert.equal(calls[0].auth, null);
    assert.equal(mockStorage.getItem('tvdb_jwt_token'), null);
    assert.ok(mockStorage.getItem(`${TVDB_EPISODES_CACHE_PREFIX}389597`));
  });

  it('requests page 1 when page 0 has links.next, and stops after page 1 when page 1 has next: null', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes('page=0')) {
        return createJsonResponse({
          status: 'success',
          data: {
            episodes: [{ id: 1001, seasonNumber: 1, number: 1, absoluteNumber: 1, name: 'Page 0 Ep' }],
          },
          links: {
            next: 'https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=1',
            total_items: 620,
            page_size: 500,
          },
        });
      }

      return createJsonResponse({
        status: 'success',
        data: {
          episodes: [{ id: 1501, seasonNumber: 1, number: 501, absoluteNumber: 501, name: 'Page 1 Ep' }],
        },
        links: {
          next: null,
          total_items: 620,
          page_size: 500,
        },
      });
    }) as typeof fetch;

    const episodes = await fetchTVDBEpisodesForSeries(81797);
    assert.deepEqual(
      episodes.map((e) => e.name),
      ['Page 0 Ep', 'Page 1 Ep']
    );
    assert.deepEqual(requestedUrls, [
      '/api/tvdb?lang=eng&op=seriesEpisodes&page=0&seasonType=default&seriesId=81797',
      '/api/tvdb?lang=eng&op=seriesEpisodes&page=1&seasonType=default&seriesId=81797',
    ]);
  });

  it('requests pages 0 -> 1 -> 2 sequentially for >1000-episode series and stops at backend max page 2', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes('page=0')) {
        return createJsonResponse({
          status: 'success',
          data: {
            episodes: [
              { id: 1, seasonNumber: 1, number: 1, absoluteNumber: 1, name: 'Ep 1' },
              { id: 500, seasonNumber: 1, number: 500, absoluteNumber: 500, name: 'Ep 500' },
            ],
          },
          links: {
            next: 'https://api4.thetvdb.com/v4/series/99901/episodes/default/eng?page=1',
            total_items: 1700,
            page_size: 500,
          },
        });
      }

      if (url.includes('page=1')) {
        return createJsonResponse({
          status: 'success',
          data: {
            episodes: [
              // Include duplicate id 500 boundary item to verify cross-page deduplication
              { id: 500, seasonNumber: 1, number: 500, absoluteNumber: 500, name: 'Ep 500' },
              { id: 501, seasonNumber: 1, number: 501, absoluteNumber: 501, name: 'Ep 501' },
            ],
          },
          links: {
            next: 'https://api4.thetvdb.com/v4/series/99901/episodes/default/eng?page=2',
            total_items: 1700,
            page_size: 500,
          },
        });
      }

      return createJsonResponse({
        status: 'success',
        data: {
          episodes: [{ id: 1001, seasonNumber: 1, number: 1001, absoluteNumber: 1001, name: 'Ep 1001' }],
        },
        links: {
          next: 'https://api4.thetvdb.com/v4/series/99901/episodes/default/eng?page=3',
          total_items: 1700,
          page_size: 500,
        },
      });
    }) as typeof fetch;

    const episodes = await fetchTVDBEpisodesForSeries(99901);
    assert.deepEqual(
      episodes.map((e) => e.id),
      [1, 500, 501, 1001]
    );
    assert.deepEqual(requestedUrls, [
      '/api/tvdb?lang=eng&op=seriesEpisodes&page=0&seasonType=default&seriesId=99901',
      '/api/tvdb?lang=eng&op=seriesEpisodes&page=1&seasonType=default&seriesId=99901',
      '/api/tvdb?lang=eng&op=seriesEpisodes&page=2&seasonType=default&seriesId=99901',
    ]);
  });

  it('never caches empty episode responses (e.g. total_items: 131, next: null, episodes: []) in memory or sessionStorage', async () => {
    const mockStorage = createMockSessionStorage();
    (globalThis as any).window = { sessionStorage: mockStorage };
    (globalThis as any).sessionStorage = mockStorage;

    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount === 1) {
        // Observed Attack on Titan shape: total_items=131, page_size=500, next=null, episodes=[]
        return createJsonResponse({
          status: 'success',
          data: { episodes: [] },
          links: {
            prev: null,
            self: 'https://api4.thetvdb.com/v4/series/267440/episodes/default/eng?page=0',
            next: null,
            total_items: 131,
            page_size: 500,
          },
        });
      }
      return createJsonResponse({
        status: 'success',
        data: {
          episodes: [{ id: 77, seasonNumber: 1, number: 1, absoluteNumber: 1, name: 'To You, in 2000 Years' }],
        },
        links: {
          prev: null,
          self: 'https://api4.thetvdb.com/v4/series/267440/episodes/default/eng?page=0',
          next: null,
          total_items: 131,
          page_size: 500,
        },
      });
    }) as typeof fetch;

    // First call returns [] and does NOT request page 1 or persist to cache
    const first = await fetchTVDBEpisodesForSeries(267440);
    assert.deepEqual(first, []);
    assert.equal(callCount, 1);
    assert.equal(mockStorage.getItem(`${TVDB_EPISODES_CACHE_PREFIX}267440`), null);

    // Second call re-fetches because empty result was not cached, then caches non-empty result
    const second = await fetchTVDBEpisodesForSeries(267440);
    assert.equal(second.length, 1);
    assert.equal(callCount, 2);
    assert.ok(mockStorage.getItem(`${TVDB_EPISODES_CACHE_PREFIX}267440`));

    // Third call is served from memory cache without a network request
    const third = await fetchTVDBEpisodesForSeries(267440);
    assert.equal(third.length, 1);
    assert.equal(callCount, 2);
  });
});

describe('Phase 3C: Artwork Selection Priority & PlayerPage Fallback Verification', () => {
  it('preserves exact 5-tier episode artwork priority in buildAnimeEpisodeList', async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes('raw.githubusercontent.com/Fribb')) {
        return createJsonResponse([
          { anilist_id: 140960, tvdb_id: 403816, mal_id: 50265, type: 'TV' },
        ]);
      }
      if (url.includes('api.jikan.moe')) {
        return createJsonResponse({ data: [] });
      }
      if (url.startsWith('/api/tvdb')) {
        return createJsonResponse({
          status: 'success',
          data: {
            episodes: [
              // Ep 1 has TVDB relative image path (Tier 1)
              { id: 1, seasonNumber: 1, number: 1, absoluteNumber: 1, name: 'TVDB Ep 1', image: '/banners/episodes/389597/1.jpg' },
              // Ep 2 has no TVDB image -> falls back to AniList streamingEpisodes[1].thumbnail (Tier 2)
              { id: 2, seasonNumber: 1, number: 2, absoluteNumber: 2, name: 'TVDB Ep 2', image: null },
              // Ep 3 has no TVDB image and no streamingEpisode thumbnail -> falls back to series backdrop (Tier 3/4)
              { id: 3, seasonNumber: 1, number: 3, absoluteNumber: 3, name: 'TVDB Ep 3', image: null },
            ],
          },
          links: { next: null, total_items: 3, page_size: 500 },
        });
      }
      return createJsonResponse({});
    }) as typeof fetch;

    const streamingEpisodes = [
      { title: 'Episode 1 - Stream', thumbnail: 'https://stream.cdn/ep1-thumb.jpg' },
      { title: 'Episode 2 - Stream', thumbnail: 'https://stream.cdn/ep2-thumb.jpg' },
    ];
    const seriesBackdrop = 'https://image.tmdb.org/t/p/w1280/series-backdrop.jpg';

    const resolved = await buildAnimeEpisodeList(140960, 3, streamingEpisodes, seriesBackdrop);
    assert.equal(resolved.length, 3);
    // Tier 1: TVDB episode image wins over streamingEpisodes[0].thumbnail and seriesBackdrop
    assert.equal(resolved[0].still_path, 'https://artworks.thetvdb.com/banners/episodes/389597/1.jpg');
    // Tier 2: AniList streamingEpisodes[1].thumbnail wins over seriesBackdrop when TVDB image is missing
    assert.equal(resolved[1].still_path, 'https://stream.cdn/ep2-thumb.jpg');
    // Tier 3/4: TMDB-enriched series backdrop (or AniList banner/cover) used when both TVDB and streamingEpisodes lack image
    assert.equal(resolved[2].still_path, 'https://image.tmdb.org/t/p/w1280/series-backdrop.jpg');

    // Tier 5: null when no fallback backdrop or thumbnail exists
    const resolvedNoBackdrop = await buildAnimeEpisodeList(950002, 1, [], null);
    assert.equal(resolvedNoBackdrop[0].still_path, null);
  });

  it('verifies PlayerPage.tsx passes details.anilist_raw?.streamingEpisodes and details.backdrop_path to buildAnimeEpisodeList', () => {
    const playerPageSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/PlayerPage.tsx'),
      'utf8'
    );

    assert.match(
      playerPageSource,
      /buildAnimeEpisodeList\(\s*parseInt\(id\)\s*,\s*numEpisodes\s*,\s*details\.anilist_raw\?\.streamingEpisodes\s*,\s*details\.backdrop_path\s*\)/
    );
  });
});
