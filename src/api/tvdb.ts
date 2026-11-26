import { indexedDbCache } from '../lib/cache/indexedDbCache';

export const TVDB_PROXY_PATH = '/api/tvdb';
export const TVDB_EPISODES_CACHE_PREFIX = 'tvdb_eps_v1_';
export const TVDB_MIN_SERIES_ID = 1;
export const TVDB_MAX_SERIES_ID = 2_147_483_647;
export const TVDB_MIN_PAGE = 0;
export const TVDB_MAX_PAGE = 2;
export const TVDB_DEFAULT_PAGE_SIZE = 500;

export interface TvdbPaginationLinks {
  prev?: string | null;
  self?: string | null;
  next?: string | null;
  total_items?: number | string | null;
  page_size?: number | string | null;
}

export interface TvdbSeriesEpisodesPayload {
  status?: string;
  data?: {
    series?: unknown;
    episodes?: any[];
  };
  links?: TvdbPaginationLinks | null;
}

const tvdbEpisodeListCache = new Map<string, any[]>();
const inFlightTvdb = new Map<string, Promise<any[]>>();
const backgroundRefreshTvdb = new Map<string, Promise<void>>();

/** Clears the in-memory TVDB episode cache and in-flight map (primarily for unit tests). */
export function resetTvdbClientCache(): void {
  tvdbEpisodeListCache.clear();
  inFlightTvdb.clear();
  backgroundRefreshTvdb.clear();
}

export function isNonEmptyTvdbEpisodeList(value: unknown): value is any[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Validates a TVDB series ID against `/api/tvdb`'s positive 32-bit signed integer bounds.
 */
export function isValidTvdbSeriesId(seriesId: unknown): seriesId is number {
  return (
    typeof seriesId === 'number' &&
    Number.isInteger(seriesId) &&
    seriesId >= TVDB_MIN_SERIES_ID &&
    seriesId <= TVDB_MAX_SERIES_ID
  );
}

/**
 * Validates a TVDB page index against `/api/tvdb`'s supported page range (`0..2`).
 */
export function isValidTvdbPage(page: unknown): page is number {
  return (
    typeof page === 'number' &&
    Number.isInteger(page) &&
    page >= TVDB_MIN_PAGE &&
    page <= TVDB_MAX_PAGE
  );
}

/**
 * Builds a deterministic `GET /api/tvdb?...` URL with alphabetically sorted query keys
 * (`lang`, `op`, `page`, `seasonType`, `seriesId`) matching `buildCanonicalTvdbGetQuery`
 * in `api/_lib/tvdb.ts` for optimal Vercel CDN cache hits.
 */
export function buildTvdbProxyUrl(
  seriesId: number,
  page = 0,
  options: { seasonType?: 'default'; lang?: 'eng' } = {}
): string {
  const safePage = isValidTvdbPage(page) ? page : 0;
  const seasonType = options.seasonType ?? 'default';
  const lang = options.lang ?? 'eng';

  const entries: Array<[string, string]> = [
    ['lang', lang],
    ['op', 'seriesEpisodes'],
    ['page', String(safePage)],
    ['seasonType', seasonType],
    ['seriesId', String(seriesId)],
  ];
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const searchParams = new URLSearchParams();
  for (const [key, value] of entries) {
    searchParams.set(key, value);
  }

  return `${TVDB_PROXY_PATH}?${searchParams.toString()}`;
}

/**
 * Determines whether the next TVDB page (`currentPage + 1`) should be requested based on the
 * actual TVDB v4 `links` metadata (`next`, `total_items`, `page_size`) and the backend's
 * supported `0..2` page range.
 *
 * Rules:
 * - Never requests beyond `TVDB_MAX_PAGE` (page 2).
 * - Requires a non-empty `links.next` string indicating TVDB has another page.
 * - If both `total_items` and `page_size` are valid positive numbers, verifies that
 *   `Math.ceil(total_items / page_size) - 1 >= currentPage + 1`.
 * - If `total_items` or `page_size` is missing/malformed, safely falls back to the presence
 *   of `links.next` while still respecting the `page <= 2` cap.
 */
export function shouldFetchNextTvdbPage(
  currentPage: number,
  links: TvdbPaginationLinks | null | undefined
): boolean {
  const nextPage = currentPage + 1;
  if (!isValidTvdbPage(currentPage) || nextPage > TVDB_MAX_PAGE) {
    return false;
  }
  if (!links || typeof links !== 'object') {
    return false;
  }

  const hasNextLink = typeof links.next === 'string' && links.next.trim().length > 0;
  if (!hasNextLink) {
    return false;
  }

  const rawTotal = links.total_items;
  const rawPageSize = links.page_size;
  const totalItems =
    typeof rawTotal === 'number'
      ? rawTotal
      : typeof rawTotal === 'string' && rawTotal.trim().length > 0
        ? Number(rawTotal)
        : NaN;
  const pageSize =
    typeof rawPageSize === 'number'
      ? rawPageSize
      : typeof rawPageSize === 'string' && rawPageSize.trim().length > 0
        ? Number(rawPageSize)
        : NaN;

  if (Number.isFinite(totalItems) && totalItems >= 0 && Number.isFinite(pageSize) && pageSize > 0) {
    if (totalItems === 0) {
      return false;
    }
    const maxPageIndex = Math.ceil(totalItems / pageSize) - 1;
    return nextPage <= Math.min(maxPageIndex, TVDB_MAX_PAGE);
  }

  return true;
}

/**
 * Deduplicates TVDB episodes across pages using a stable episode identifier
 * while preserving the original episode ordering returned by TVDB.
 */
export function deduplicateTvdbEpisodes(episodes: readonly any[]): any[] {
  const seenKeys = new Set<string>();
  const deduplicated: any[] = [];

  for (const ep of episodes) {
    if (!ep || typeof ep !== 'object') continue;

    let stableKey: string | null = null;
    if (ep.id !== undefined && ep.id !== null && String(ep.id).trim().length > 0) {
      stableKey = `id:${String(ep.id).trim()}`;
    } else if (
      typeof ep.seasonNumber === 'number' &&
      typeof ep.number === 'number'
    ) {
      stableKey = `s:${ep.seasonNumber}:e:${ep.number}:abs:${ep.absoluteNumber ?? ''}`;
    } else if (typeof ep.absoluteNumber === 'number') {
      stableKey = `abs:${ep.absoluteNumber}`;
    }

    if (stableKey !== null) {
      if (seenKeys.has(stableKey)) continue;
      seenKeys.add(stableKey);
    }

    deduplicated.push(ep);
  }

  return deduplicated;
}

async function fetchTvdbEpisodesPage(
  seriesId: number,
  page: number
): Promise<TvdbSeriesEpisodesPayload | null> {
  const url = buildTvdbProxyUrl(seriesId, page);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return null;
  }
  return json as TvdbSeriesEpisodesPayload;
}

function hydrateTvdbL1AndSession(cacheKey: string, episodes: any[]): void {
  if (!isNonEmptyTvdbEpisodeList(episodes)) return;
  tvdbEpisodeListCache.set(cacheKey, episodes);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(episodes));
    } catch {
      // ignore sessionStorage quota errors
    }
  }
}

async function fetchAndPersistTvdbSeriesEpisodes(
  numericId: number,
  cacheKey: string
): Promise<any[]> {
  try {
    const page0Payload = await fetchTvdbEpisodesPage(numericId, 0);
    if (!page0Payload) return [];

    const rawEpisodes: any[] = Array.isArray(page0Payload.data?.episodes)
      ? [...page0Payload.data!.episodes!]
      : [];

    // Only request page 1 when page 0 indicates another page is available.
    // Only request page 2 when page 1 also indicates another page is available and within cap (0..2).
    let currentPage = 0;
    let currentLinks = page0Payload.links;

    while (shouldFetchNextTvdbPage(currentPage, currentLinks)) {
      const nextPage = currentPage + 1;
      const nextPayload = await fetchTvdbEpisodesPage(numericId, nextPage).catch(() => null);
      if (!nextPayload) break;

      if (Array.isArray(nextPayload.data?.episodes) && nextPayload.data!.episodes!.length > 0) {
        rawEpisodes.push(...nextPayload.data!.episodes!);
      }

      currentPage = nextPage;
      currentLinks = nextPayload.links;
    }

    const allEpisodes = deduplicateTvdbEpisodes(rawEpisodes);

    // Preserve backend cache contract: only cache non-empty episode lists.
    if (isNonEmptyTvdbEpisodeList(allEpisodes)) {
      hydrateTvdbL1AndSession(cacheKey, allEpisodes);
      void indexedDbCache.set('tvdb', cacheKey, allEpisodes, {
        validate: isNonEmptyTvdbEpisodeList,
      });
    }

    return allEpisodes;
  } catch (e) {
    console.error('TVDB fetch failed', e);
    return [];
  }
}

function triggerTvdbBackgroundRefresh(numericId: number, cacheKey: string): void {
  if (backgroundRefreshTvdb.has(cacheKey)) return;
  const refreshPromise = fetchAndPersistTvdbSeriesEpisodes(numericId, cacheKey)
    .then(() => undefined)
    .finally(() => {
      backgroundRefreshTvdb.delete(cacheKey);
    });
  backgroundRefreshTvdb.set(cacheKey, refreshPromise);
}

export const fetchTVDBEpisodesForSeries = async (tvdbId: number): Promise<any[]> => {
  const numericId = typeof tvdbId === 'number' ? tvdbId : Number(tvdbId);
  if (!isValidTvdbSeriesId(numericId)) {
    return [];
  }

  const cacheKey = `${TVDB_EPISODES_CACHE_PREFIX}${numericId}`;
  if (tvdbEpisodeListCache.has(cacheKey)) {
    const cachedMem = tvdbEpisodeListCache.get(cacheKey)!;
    if (isNonEmptyTvdbEpisodeList(cachedMem)) {
      return cachedMem;
    }
    tvdbEpisodeListCache.delete(cacheKey);
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isNonEmptyTvdbEpisodeList(parsed)) {
          tvdbEpisodeListCache.set(cacheKey, parsed);
          return parsed;
        }
        sessionStorage.removeItem(cacheKey);
      }
    } catch {
      // ignore
    }
  }

  if (inFlightTvdb.has(cacheKey)) return inFlightTvdb.get(cacheKey)!;

  const promise = (async () => {
    try {
      const l2Lookup = await indexedDbCache.get<any[]>('tvdb', cacheKey, {
        validate: isNonEmptyTvdbEpisodeList,
      });

      if (l2Lookup) {
        hydrateTvdbL1AndSession(cacheKey, l2Lookup.value);
        if (l2Lookup.status === 'stale') {
          triggerTvdbBackgroundRefresh(numericId, cacheKey);
        }
        return l2Lookup.value;
      }
    } catch {
      // Fall through to network fetch if IndexedDB fails
    }

    return fetchAndPersistTvdbSeriesEpisodes(numericId, cacheKey);
  })();

  inFlightTvdb.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightTvdb.delete(cacheKey);
  }
};

