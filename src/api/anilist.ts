import { resolveAnimeMapping, preloadFribbMapping } from './fribb';
import { extractBestLogoPath, primeLogoCache, IMAGE_BASE_URL_W500, setSeedItem, getSeedItem } from './tmdb';
import { isValidTmdbId, sanitizeTmdbTitleFallbackQuery, tmdbProxyFetch } from './tmdbProxy';
import { indexedDbCache } from '../lib/cache/indexedDbCache';

export const ANILIST_PROXY_PATH = '/api/anilist';
export const ANILIST_SESSION_CACHE_PREFIX = 'anilist_v3_';
export const ANILIST_MIN_PER_PAGE = 1;
export const ANILIST_MAX_PER_PAGE = 50;
export const ANILIST_MIN_PAGE = 1;
export const ANILIST_MAX_PAGE = 500;
export const ANILIST_MIN_ID = 1;
export const ANILIST_MAX_ID = 2_147_483_647;
export const ANILIST_MAX_SEARCH_LENGTH = 120;
export const ANILIST_MAX_GENRE_TAG_LENGTH = 64;

export type AnilistClientOperation =
  | 'trending'
  | 'newlyAdded'
  | 'details'
  | 'byGenre'
  | 'byTag'
  | 'topRated'
  | 'top100'
  | 'search';

export type AnilistQueryParamValue = string | number | null | undefined;
export type AnilistQueryParams = Record<string, AnilistQueryParamValue>;

const CONTROL_CHAR_GLOBAL_REGEX = /[\u0000-\u001f\u007f]/g;
const GENRE_VALIDATION_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]*$/;
const TAG_VALIDATION_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s'\/-]*$/;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class AnilistHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AnilistHttpError';
    this.status = status;
  }
}

/**
 * Clamps `perPage` to `/api/anilist`'s valid integer bounds (`1..50`).
 */
export function clampAnilistPerPage(perPage: unknown, defaultPerPage: number): number {
  const numeric = typeof perPage === 'number' ? perPage : Number(perPage);
  if (!Number.isFinite(numeric)) {
    return defaultPerPage;
  }
  const intVal = Math.trunc(numeric);
  return Math.min(Math.max(intVal, ANILIST_MIN_PER_PAGE), ANILIST_MAX_PER_PAGE);
}

/**
 * Clamps `page` to `/api/anilist`'s valid integer bounds (`1..500`).
 */
export function clampAnilistPage(page: unknown, defaultPage = 1): number {
  const numeric = typeof page === 'number' ? page : Number(page);
  if (!Number.isFinite(numeric)) {
    return defaultPage;
  }
  const intVal = Math.trunc(numeric);
  return Math.min(Math.max(intVal, ANILIST_MIN_PAGE), ANILIST_MAX_PAGE);
}

/**
 * Validates an AniList media ID against `/api/anilist`'s positive 32-bit signed integer bounds.
 */
export function isValidAnilistId(id: unknown): id is number {
  return (
    typeof id === 'number' &&
    Number.isInteger(id) &&
    id >= ANILIST_MIN_ID &&
    id <= ANILIST_MAX_ID
  );
}

/**
 * Sanitizes an anime search query for `GET /api/anilist?op=search`:
 * - Strips ASCII control characters rejected by `/api/anilist`.
 * - Trims leading/trailing whitespace.
 * - Caps length to `ANILIST_MAX_SEARCH_LENGTH` (120 chars).
 * - Returns `null` when empty so callers short-circuit without making a 400 request.
 */
export function sanitizeAnilistSearchQuery(rawSearch: unknown): string | null {
  if (typeof rawSearch !== 'string') return null;
  const cleaned = rawSearch.replace(CONTROL_CHAR_GLOBAL_REGEX, ' ').trim();
  if (cleaned.length === 0) return null;
  const bounded = cleaned.slice(0, ANILIST_MAX_SEARCH_LENGTH).trim();
  return bounded.length > 0 ? bounded : null;
}

/**
 * Validates and normalizes a `genre` value against `/api/anilist`'s `byGenre` rule.
 */
export function sanitizeAnilistGenre(rawGenre: unknown): string | null {
  if (typeof rawGenre !== 'string') return null;
  const cleaned = rawGenre.replace(CONTROL_CHAR_GLOBAL_REGEX, '').trim();
  if (
    cleaned.length === 0 ||
    cleaned.length > ANILIST_MAX_GENRE_TAG_LENGTH ||
    !GENRE_VALIDATION_REGEX.test(cleaned)
  ) {
    return null;
  }
  return cleaned;
}

/**
 * Validates and normalizes a `tag` value against `/api/anilist`'s `byTag` rule.
 */
export function sanitizeAnilistTag(rawTag: unknown): string | null {
  if (typeof rawTag !== 'string') return null;
  const cleaned = rawTag.replace(CONTROL_CHAR_GLOBAL_REGEX, '').trim();
  if (
    cleaned.length === 0 ||
    cleaned.length > ANILIST_MAX_GENRE_TAG_LENGTH ||
    !TAG_VALIDATION_REGEX.test(cleaned)
  ) {
    return null;
  }
  return cleaned;
}

/**
 * Builds a deterministic `GET /api/anilist?...` URL with all query parameter keys
 * (`op` plus operation variables) sorted lexicographically for optimal Vercel CDN cache hits.
 */
export function buildAnilistProxyUrl(
  operation: AnilistClientOperation,
  params: AnilistQueryParams = {}
): string {
  const entries: Array<[string, string]> = [['op', operation]];

  for (const [key, rawValue] of Object.entries(params)) {
    if (key === 'op' || rawValue === undefined || rawValue === null) continue;
    const valueStr = String(rawValue);
    if (valueStr.length === 0) continue;
    entries.push([key, valueStr]);
  }

  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const searchParams = new URLSearchParams();
  for (const [key, value] of entries) {
    searchParams.set(key, value);
  }

  return `${ANILIST_PROXY_PATH}?${searchParams.toString()}`;
}

/**
 * Determines whether an AniList proxy error is transient and safe to retry.
 * Permanent client errors (400, 401, 403, 404, 405, 422) are NEVER retried.
 */
export function isTransientAnilistError(error: unknown): boolean {
  if (error instanceof AnilistHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return true;
}

preloadFribbMapping();

interface TmdbAnimeMediaCache {
  poster_path: string | null;
  backdrop_path: string | null;
  logo_path: string | null;
}

const tmdbMediaMemoryCache = new Map<string, TmdbAnimeMediaCache>();
const inFlightTmdbMedia = new Map<string, Promise<TmdbAnimeMediaCache | null>>();
const backgroundRefreshTmdbMedia = new Map<string, Promise<void>>();
const anilistResponseCache = new Map<string, any>();
const inFlightAniList = new Map<string, Promise<any>>();
const backgroundRefreshAniList = new Map<string, Promise<void>>();

/** Clears the in-memory AniList and TMDB anime artwork caches (primarily for unit tests). */
export function resetAnilistClientCache(): void {
  tmdbMediaMemoryCache.clear();
  inFlightTmdbMedia.clear();
  backgroundRefreshTmdbMedia.clear();
  anilistResponseCache.clear();
  inFlightAniList.clear();
  backgroundRefreshAniList.clear();
}

export function isValidAnilistGraphqlPayload(
  json: unknown
): json is { data: Record<string, any> } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
  const candidate = json as Record<string, any>;
  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) return false;
  if (!candidate.data || typeof candidate.data !== 'object' || Array.isArray(candidate.data)) {
    return false;
  }
  return true;
}

function isValidTmdbAnimeMediaCache(val: unknown): val is TmdbAnimeMediaCache {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  const validField = (v: unknown) => v === null || typeof v === 'string';
  return validField(obj.poster_path) && validField(obj.backdrop_path) && validField(obj.logo_path);
}

function hydrateTmdbAnimeMediaL1AndLocal(
  key: string,
  tmdbType: string,
  tmdbId: number | string,
  result: TmdbAnimeMediaCache
): void {
  tmdbMediaMemoryCache.set(key, result);
  primeLogoCache(tmdbType, tmdbId, result.logo_path);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(result));
    } catch {
      // ignore quota errors
    }
  }
}

async function fetchAndPersistTmdbAnimeMedia(
  key: string,
  tmdbId: number | string,
  tmdbType: string
): Promise<TmdbAnimeMediaCache | null> {
  if ((tmdbType !== 'movie' && tmdbType !== 'tv') || !isValidTmdbId(tmdbId)) {
    return null;
  }

  try {
    const res = await tmdbProxyFetch(`${tmdbType}/${tmdbId}`, {
      append_to_response: 'images',
    });
    if (res.ok) {
      const data = await res.json();
      const bestLogo = extractBestLogoPath(data.images?.logos || []);
      const result: TmdbAnimeMediaCache = {
        poster_path: data.poster_path || null,
        backdrop_path: data.backdrop_path || null,
        logo_path: bestLogo ? `${IMAGE_BASE_URL_W500}${bestLogo}` : null,
      };

      hydrateTmdbAnimeMediaL1AndLocal(key, tmdbType, tmdbId, result);
      void indexedDbCache.set('tmdb', key, result, {
        validate: isValidTmdbAnimeMediaCache,
      });
      return result;
    }
  } catch {
    // ignore
  }
  return null;
}

const fetchTmdbImages = async (tmdbId: number | string, tmdbType: string): Promise<TmdbAnimeMediaCache | null> => {
  const key = `tmdb_anime_v2_${tmdbType}_${tmdbId}`;

  if (tmdbMediaMemoryCache.has(key)) {
    const cached = tmdbMediaMemoryCache.get(key)!;
    primeLogoCache(tmdbType, tmdbId, cached.logo_path);
    return cached;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isValidTmdbAnimeMediaCache(parsed)) {
          tmdbMediaMemoryCache.set(key, parsed);
          primeLogoCache(tmdbType, tmdbId, parsed.logo_path);
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  if (inFlightTmdbMedia.has(key)) {
    return inFlightTmdbMedia.get(key)!;
  }

  const promise = (async () => {
    if ((tmdbType !== 'movie' && tmdbType !== 'tv') || !isValidTmdbId(tmdbId)) {
      return null;
    }

    try {
      const l2Hit = await indexedDbCache.get<TmdbAnimeMediaCache>('tmdb', key, {
        validate: isValidTmdbAnimeMediaCache,
      });
      if (l2Hit) {
        hydrateTmdbAnimeMediaL1AndLocal(key, tmdbType, tmdbId, l2Hit.value);
        if (l2Hit.status === 'stale' && !backgroundRefreshTmdbMedia.has(key)) {
          const refreshPromise = fetchAndPersistTmdbAnimeMedia(key, tmdbId, tmdbType)
            .then(() => undefined)
            .finally(() => {
              backgroundRefreshTmdbMedia.delete(key);
            });
          backgroundRefreshTmdbMedia.set(key, refreshPromise);
        }
        return l2Hit.value;
      }
    } catch {
      // Fall through to network fetch if IndexedDB fails
    }

    return fetchAndPersistTmdbAnimeMedia(key, tmdbId, tmdbType);
  })();

  inFlightTmdbMedia.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlightTmdbMedia.delete(key);
  }
};

function hydrateAniListL1AndSession(cacheKey: string, json: { data: Record<string, any> }): void {
  if (!isValidAnilistGraphqlPayload(json)) return;
  anilistResponseCache.set(cacheKey, json);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(json));
    } catch {
      // ignore
    }
  }
}

async function fetchAndPersistAniListNetwork(
  url: string,
  cacheKey: string,
  persistToIndexedDb: boolean,
  retries: number
): Promise<any> {
  const options: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 429 && i < retries - 1) {
          const retryAfter = response.headers.get('Retry-After');
          const parsedRetry = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
          const delay = Number.isFinite(parsedRetry) && parsedRetry > 0 ? parsedRetry * 1000 : (i + 1) * 800;
          await sleep(delay);
          continue;
        }
        throw new AnilistHttpError(response.status, 'AniList API error: ' + response.status);
      }

      const json = await response.json();
      if (!isValidAnilistGraphqlPayload(json)) {
        throw new AnilistHttpError(502, 'Invalid AniList response payload');
      }

      hydrateAniListL1AndSession(cacheKey, json);
      if (persistToIndexedDb) {
        void indexedDbCache.set('anilist', cacheKey, json, {
          validate: isValidAnilistGraphqlPayload,
        });
      }
      return json;
    } catch (e: unknown) {
      if (i === retries - 1 || !isTransientAnilistError(e)) {
        throw e;
      }
      await sleep((i + 1) * 400);
    }
  }
}

const fetchAniList = async (
  operation: AnilistClientOperation,
  params: AnilistQueryParams = {},
  retries = 3
): Promise<any> => {
  const url = buildAnilistProxyUrl(operation, params);
  const queryString = url.slice(ANILIST_PROXY_PATH.length + 1);
  const cacheKey = `${ANILIST_SESSION_CACHE_PREFIX}${queryString}`;
  // Ephemeral search queries stay in L1 memory + sessionStorage only; catalog/details persist to L2 IndexedDB
  const persistToIndexedDb = operation !== 'search';

  if (anilistResponseCache.has(cacheKey)) {
    const cached = anilistResponseCache.get(cacheKey);
    if (isValidAnilistGraphqlPayload(cached)) {
      return cached;
    }
    anilistResponseCache.delete(cacheKey);
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (isValidAnilistGraphqlPayload(parsed)) {
          anilistResponseCache.set(cacheKey, parsed);
          return parsed;
        }
        sessionStorage.removeItem(cacheKey);
      }
    } catch {
      // ignore
    }
  }

  if (inFlightAniList.has(cacheKey)) {
    return inFlightAniList.get(cacheKey)!;
  }

  const requestPromise = (async () => {
    if (persistToIndexedDb) {
      try {
        const l2Hit = await indexedDbCache.get<{ data: Record<string, any> }>('anilist', cacheKey, {
          validate: isValidAnilistGraphqlPayload,
        });
        if (l2Hit) {
          hydrateAniListL1AndSession(cacheKey, l2Hit.value);
          if (l2Hit.status === 'stale' && !backgroundRefreshAniList.has(cacheKey)) {
            const refreshPromise = fetchAndPersistAniListNetwork(url, cacheKey, true, retries)
              .then(() => undefined)
              .catch(() => undefined)
              .finally(() => {
                backgroundRefreshAniList.delete(cacheKey);
              });
            backgroundRefreshAniList.set(cacheKey, refreshPromise);
          }
          return l2Hit.value;
        }
      } catch {
        // Fall through to network fetch if IndexedDB fails
      }
    }

    return fetchAndPersistAniListNetwork(url, cacheKey, persistToIndexedDb, retries);
  })();

  inFlightAniList.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightAniList.delete(cacheKey);
  }
};

const normalizeAniListToTmdb = async (media: any, skipTmdbImages: boolean = false): Promise<any> => {
  if (!media) return null;

  // Check if we already fully normalized this anime with TMDB images
  if (!skipTmdbImages) {
    const existing = getSeedItem('anime', media.id);
    if (existing && existing.anilist_raw?.relations) {
      return existing;
    }
  }
  
  const mapping = await resolveAnimeMapping(media.id);
  const title = media.title?.english || media.title?.romaji || media.title?.native;
  const isMovieFormat = media.format === 'MOVIE' || mapping.type === 'MOVIE';
  let tmdbId = isMovieFormat && mapping.tmdbMovieId ? mapping.tmdbMovieId : (mapping.tmdbTvId || mapping.tmdbMovieId);
  let tmdbType = (isMovieFormat && mapping.tmdbMovieId) ? 'movie' : (mapping.tmdbTvId ? 'tv' : 'movie');
  const tmdbSeason = mapping.seasonMappingTVDB;

  if (!skipTmdbImages && !tmdbId && title) {
    const clean = sanitizeTmdbTitleFallbackQuery(title);
    if (clean) {
      try {
        const res = await tmdbProxyFetch('search/multi', {
          include_adult: false,
          language: 'en-US',
          query: clean,
        });
        if (res.ok) {
          const sData = await res.json();
          const first = sData.results?.find((r: any) => (r.media_type === 'tv' || r.media_type === 'movie'));
          if (first) {
            tmdbId = first.id;
            tmdbType = first.media_type;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  let poster_path = media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = media.bannerImage || media.coverImage?.extraLarge;
  let logo_path: string | null = null;
  
  if (!skipTmdbImages && tmdbId && tmdbType) {
    const tmdbImages = await fetchTmdbImages(tmdbId, tmdbType);
    if (tmdbImages) {
      if (tmdbImages.poster_path) poster_path = tmdbImages.poster_path;
      if (tmdbImages.backdrop_path) backdrop_path = tmdbImages.backdrop_path;
      if (tmdbImages.logo_path) logo_path = tmdbImages.logo_path;
    }
  }

  const normalized = {
    id: media.id,
    tmdb_id: tmdbId,
    tmdb_season: tmdbSeason,
    tmdb_type: tmdbType,
    fribb_mapping: mapping,
    source: 'anilist',
    media_type: 'anime',
    anime_format: tmdbType,
    title: title,
    original_title: media.title?.native,
    name: title,
    original_name: media.title?.native,
    overview: media.description?.replace(/<[^>]*>?/gm, ''),
    poster_path: poster_path,
    backdrop_path: backdrop_path,
    logo_path: logo_path,
    vote_average: media.averageScore ? media.averageScore / 10 : 0,
    first_air_date: media.startDate?.year ? `${media.startDate.year}-${String(media.startDate.month).padStart(2, '0')}-${String(media.startDate.day).padStart(2, '0')}` : undefined,
    genre_ids: [], 
    genres: media.genres?.map((g: string) => ({ id: g, name: g })) || [],
    status: media.status === 'RELEASING' ? 'Returning Series' : (media.status === 'FINISHED' ? 'Ended' : media.status),
    number_of_episodes: media.episodes,
    trailer: media.trailer?.site === 'youtube' ? media.trailer.id : null,
    anilist_raw: media
  };

  if (!skipTmdbImages) {
    setSeedItem('anime', media.id, normalized);
  }
  return normalized;
};

export const fetchTrendingAnime = async (perPage = 10, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const safePerPage = clampAnilistPerPage(perPage, 10);
  try {
    const data = await fetchAniList('trending', { perPage: safePerPage });
    const mediaItems = data?.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchTrendingAnime failed:', e);
    return { results: [] };
  }
};

export const fetchNewlyAddedAnime = async (perPage = 10, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const safePerPage = clampAnilistPerPage(perPage, 10);
  try {
    const data = await fetchAniList('newlyAdded', { perPage: safePerPage });
    const mediaItems = data?.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchNewlyAddedAnime failed:', e);
    return { results: [] };
  }
};

export const fetchAnimeDetails = async (id: number) => {
  const numericId = typeof id === 'number' ? id : Number(id);
  if (!isValidAnilistId(numericId)) {
    return null;
  }

  // Instant return if already cached in memory with relations
  const cached = getSeedItem('anime', numericId);
  if (cached && cached.anilist_raw?.relations) {
    return cached;
  }

  await preloadFribbMapping();
  try {
    const data = await fetchAniList('details', { id: numericId });
    return await normalizeAniListToTmdb(data?.data?.Media);
  } catch (e) {
    console.error(`fetchAnimeDetails failed for ${numericId}:`, e);
    return cached || null;
  }
};

export const fetchAnimeByGenre = async (genre: string, perPage = 20, skipTmdbImages = false) => {
  const safeGenre = sanitizeAnilistGenre(genre);
  if (!safeGenre) {
    return { results: [] };
  }

  await preloadFribbMapping();
  const safePerPage = clampAnilistPerPage(perPage, 20);
  try {
    const data = await fetchAniList('byGenre', { genre: safeGenre, perPage: safePerPage });
    const mediaItems = data?.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`fetchAnimeByGenre failed for ${genre}:`, e);
    return { results: [] };
  }
};

export const fetchAnimeByTag = async (tag: string, perPage = 20, skipTmdbImages = false) => {
  const safeTag = sanitizeAnilistTag(tag);
  if (!safeTag) {
    return { results: [] };
  }

  await preloadFribbMapping();
  const safePerPage = clampAnilistPerPage(perPage, 20);
  try {
    const data = await fetchAniList('byTag', { perPage: safePerPage, tag: safeTag });
    const mediaItems = data?.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`fetchAnimeByTag failed for ${tag}:`, e);
    return { results: [] };
  }
};

export const fetchTopRatedAnime = async (perPage = 20, skipTmdbImages = false, page = 1) => {
  await preloadFribbMapping();
  const safePage = clampAnilistPage(page, 1);
  const safePerPage = clampAnilistPerPage(perPage, 20);
  try {
    const data = await fetchAniList('topRated', { page: safePage, perPage: safePerPage });
    const mediaItems = data?.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchTopRatedAnime failed:', e);
    return { results: [] };
  }
};

export const fetchTop100Anime = async (perPage = 30, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const safePerPage = clampAnilistPerPage(perPage, 30);
  try {
    const data = await fetchAniList('top100', { perPage: safePerPage });
    const mediaItems = data?.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchTop100Anime failed:', e);
    return { results: [] };
  }
};

export const searchAnime = async (search: string, perPage = 20, skipTmdbImages = false) => {
  const safeSearch = sanitizeAnilistSearchQuery(search);
  if (!safeSearch) {
    return { results: [] };
  }

  await preloadFribbMapping();
  const safePerPage = clampAnilistPerPage(perPage, 20);
  try {
    const data = await fetchAniList('search', { perPage: safePerPage, search: safeSearch });
    const mediaItems = data?.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`searchAnime failed for ${search}:`, e);
    return { results: [] };
  }
};
