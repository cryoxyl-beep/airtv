import { fetchAnimeByGenre, fetchAnimeByTag } from '../api/anilist';
import { fetchByGenre, fetchTVByGenre, IMAGE_BASE_URL_W500, isAnime } from '../api/tmdb';
import { NICHE_CONFIGS, NicheDefinition } from '../config/nicheConfig';
import { dedupeItems } from '../utils/dedupe';

export interface NichePosterItem {
  key: string;
  id: number | string;
  title: string;
  posterUrl: string;
  mediaType: 'anime' | 'movie' | 'tv';
  source: 'anilist' | 'tmdb';
  year?: string;
  rawItem: any;
}

export interface NicheCollectionData {
  niche: NicheDefinition;
  posters: NichePosterItem[];         // 5 deterministic posters for the initial static layered fan stack
  carouselPosters: NichePosterItem[]; // Up to 15 mixed-media posters (initial 5 + ~10 additional) for the hover carousel
  items: NichePosterItem[];           // Full mixed-media collection for this niche
  counts: {
    total: number;
    anime: number;
    movies: number;
    tv: number;
  };
}

const nicheDataCache = new Map<string, NicheCollectionData>();
let allNichesPromise: Promise<Record<string, NicheCollectionData>> | null = null;

// Shared request caches so shared genres across niches only fire once
const movieGenrePromiseCache = new Map<number, Promise<any[]>>();
const tvGenrePromiseCache = new Map<number, Promise<any[]>>();
const animeGenrePromiseCache = new Map<string, Promise<any[]>>();
const animeTagPromiseCache = new Map<string, Promise<any[]>>();

// Track preloaded/decoded poster URLs so hover carousels never show blank frames
const preloadedPosterUrls = new Set<string>();
const inFlightPreloads = new Map<string, Promise<boolean>>();

export function markPosterUrlLoaded(url: string): void {
  if (url) {
    preloadedPosterUrls.add(url);
  }
}

export function isPosterUrlReady(url: string): boolean {
  return Boolean(url && preloadedPosterUrls.has(url));
}

function preloadSinglePosterUrl(url: string): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (preloadedPosterUrls.has(url)) return Promise.resolve(true);
  if (inFlightPreloads.has(url)) return inFlightPreloads.get(url)!;

  const promise = new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      resolve(false);
      return;
    }
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.onload = () => {
      preloadedPosterUrls.add(url);
      inFlightPreloads.delete(url);
      resolve(true);
    };
    img.onerror = () => {
      inFlightPreloads.delete(url);
      resolve(false);
    };
    img.src = url;
  });

  inFlightPreloads.set(url, promise);
  return promise;
}

export async function preloadNicheCarouselImages(
  nicheId: string,
  onPosterReady?: (url: string) => void
): Promise<void> {
  const data = nicheDataCache.get(nicheId);
  if (!data) return;

  const allPool = data.carouselPosters || data.posters || [];
  await Promise.all(
    allPool.map(async (item) => {
      const ok = await preloadSinglePosterUrl(item.posterUrl);
      if (ok && onPosterReady) {
        onPosterReady(item.posterUrl);
      }
    })
  );
}

function getMoviesForGenre(genreId: number): Promise<any[]> {
  if (!movieGenrePromiseCache.has(genreId)) {
    movieGenrePromiseCache.set(
      genreId,
      fetchByGenre(genreId)
        .then((res) => (res?.results || []).filter((item: any) => !isAnime(item)))
        .catch(() => [])
    );
  }
  return movieGenrePromiseCache.get(genreId)!;
}

function getTVForGenre(genreId: number): Promise<any[]> {
  if (!tvGenrePromiseCache.has(genreId)) {
    tvGenrePromiseCache.set(
      genreId,
      fetchTVByGenre(genreId)
        .then((res) => (res?.results || []).filter((item: any) => !isAnime(item)))
        .catch(() => [])
    );
  }
  return tvGenrePromiseCache.get(genreId)!;
}

function getAnimeForGenre(genre: string): Promise<any[]> {
  if (!animeGenrePromiseCache.has(genre)) {
    // Pass skipTmdbImages = true so AniList is the exclusive metadata & poster source for anime
    animeGenrePromiseCache.set(
      genre,
      fetchAnimeByGenre(genre, 15, true)
        .then((res) => res?.results || [])
        .catch(() => [])
    );
  }
  return animeGenrePromiseCache.get(genre)!;
}

function getAnimeForTag(tag: string): Promise<any[]> {
  if (!animeTagPromiseCache.has(tag)) {
    animeTagPromiseCache.set(
      tag,
      fetchAnimeByTag(tag, 15, true)
        .then((res) => res?.results || [])
        .catch(() => [])
    );
  }
  return animeTagPromiseCache.get(tag)!;
}

/**
 * Extracts strictly the AniList cover artwork for anime items (never TMDB posters),
 * and constructs TMDB poster URLs for Movies and TV series using IMAGE_BASE_URL_W500.
 */
function toNichePosterItem(item: any, expectedType: 'anime' | 'movie' | 'tv'): NichePosterItem | null {
  if (!item || !item.id) return null;

  if (expectedType === 'anime' || item.source === 'anilist') {
    const anilistCover =
      item.anilist_raw?.coverImage?.extraLarge ||
      item.anilist_raw?.coverImage?.large ||
      (typeof item.poster_path === 'string' && item.poster_path.includes('anilist.co') ? item.poster_path : null);

    if (!anilistCover) return null;

    const title =
      item.anilist_raw?.title?.english ||
      item.anilist_raw?.title?.romaji ||
      item.title ||
      item.name ||
      'Untitled Anime';

    const year = item.anilist_raw?.startDate?.year
      ? String(item.anilist_raw.startDate.year)
      : item.first_air_date?.slice(0, 4);

    return {
      key: `anilist_${item.id}`,
      id: item.id,
      title,
      posterUrl: anilistCover,
      mediaType: 'anime',
      source: 'anilist',
      year,
      rawItem: {
        ...item,
        source: 'anilist',
        poster_path: anilistCover,
        backdrop_path: item.backdrop_path || item.anilist_raw?.bannerImage || anilistCover,
      },
    };
  }

  // Strictly exclude any anime from TMDB movie/TV pools
  if (isAnime(item)) return null;

  const rawPoster = item.poster_path;
  if (!rawPoster || typeof rawPoster !== 'string') return null;

  const posterUrl = rawPoster.startsWith('http')
    ? rawPoster
    : `${IMAGE_BASE_URL_W500}${rawPoster}`;

  const title = item.title || item.name || 'Untitled';
  const dateStr = item.release_date || item.first_air_date || '';
  const year = dateStr ? dateStr.slice(0, 4) : undefined;

  return {
    key: `tmdb_${expectedType}_${item.id}`,
    id: item.id,
    title,
    posterUrl,
    mediaType: expectedType,
    source: 'tmdb',
    year,
    rawItem: { ...item, media_type: expectedType },
  };
}

function dedupePosterItems(items: NichePosterItem[]): NichePosterItem[] {
  const seenKeys = new Set<string>();
  const seenTitles = new Set<string>();
  const result: NichePosterItem[] = [];

  for (const item of items) {
    const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenKeys.has(item.key) || (normTitle && seenTitles.has(normTitle))) continue;
    seenKeys.add(item.key);
    if (normTitle) seenTitles.add(normTitle);
    result.push(item);
  }
  return result;
}

export function getCachedNicheCollections(): Record<string, NicheCollectionData> | null {
  if (nicheDataCache.size === NICHE_CONFIGS.length) {
    const out: Record<string, NicheCollectionData> = {};
    nicheDataCache.forEach((val, key) => {
      out[key] = val;
    });
    return out;
  }
  return null;
}

export async function loadAllNicheCollections(): Promise<Record<string, NicheCollectionData>> {
  const cached = getCachedNicheCollections();
  if (cached) return cached;
  if (allNichesPromise) return allNichesPromise;

  allNichesPromise = (async () => {
    const usedShowcaseKeys = new Set<string>();
    const results: Record<string, NicheCollectionData> = {};

    // Fetch each niche's raw pools concurrently (shared genres are deduplicated via promise caches)
    const rawNichePools = await Promise.all(
      NICHE_CONFIGS.map(async (niche) => {
        const [movieArrays, tvArrays, animeGenreArrays, animeTagArrays] = await Promise.all([
          Promise.all(niche.tmdbMovieGenres.map((id) => getMoviesForGenre(id))),
          Promise.all(niche.tmdbTvGenres.map((id) => getTVForGenre(id))),
          Promise.all(niche.anilistGenres.map((g) => getAnimeForGenre(g))),
          Promise.all(niche.anilistTags.map((t) => getAnimeForTag(t))),
        ]);

        const rawMovies = dedupeItems(movieArrays.flat());
        const rawTv = dedupeItems(tvArrays.flat());
        const rawAnime = dedupeItems([...animeGenreArrays.flat(), ...animeTagArrays.flat()]);

        const movieItems = dedupePosterItems(
          rawMovies.map((m) => toNichePosterItem(m, 'movie')).filter((x): x is NichePosterItem => Boolean(x))
        );
        const tvItems = dedupePosterItems(
          rawTv.map((t) => toNichePosterItem(t, 'tv')).filter((x): x is NichePosterItem => Boolean(x))
        );
        const animeItems = dedupePosterItems(
          rawAnime.map((a) => toNichePosterItem(a, 'anime')).filter((x): x is NichePosterItem => Boolean(x))
        );

        return {
          niche,
          movieItems,
          tvItems,
          animeItems,
        };
      })
    );

    // Deterministically build each niche's unified collection, 5-poster showcase fan, and 15-poster hover carousel pool
    for (let idx = 0; idx < rawNichePools.length; idx++) {
      const { niche, movieItems, tvItems, animeItems } = rawNichePools[idx];

      // Interleave Movies, Anime, and TV Series into a unified mixed-media collection
      const interleaved: NichePosterItem[] = [];
      const maxLen = Math.max(movieItems.length, tvItems.length, animeItems.length);
      for (let i = 0; i < maxLen; i++) {
        if (movieItems[i]) interleaved.push(movieItems[i]);
        if (animeItems[i]) interleaved.push(animeItems[i]);
        if (tvItems[i]) interleaved.push(tvItems[i]);
      }
      const unifiedItems = dedupePosterItems(interleaved);

      const pickUnused = (pool: NichePosterItem[], localUsed: Set<string>): NichePosterItem | null => {
        for (const candidate of pool) {
          if (!localUsed.has(candidate.key) && !usedShowcaseKeys.has(candidate.key)) {
            localUsed.add(candidate.key);
            usedShowcaseKeys.add(candidate.key);
            return candidate;
          }
        }
        for (const candidate of pool) {
          if (!localUsed.has(candidate.key)) {
            localUsed.add(candidate.key);
            return candidate;
          }
        }
        return null;
      };

      const localUsed = new Set<string>();
      const showcase: NichePosterItem[] = [];

      // Deterministic slot order ensuring every niche has a mix of Anime (AniList), Movie (TMDB), and TV (TMDB)
      const slotPools =
        idx % 3 === 0
          ? [movieItems, animeItems, tvItems, animeItems, movieItems]
          : idx % 3 === 1
          ? [animeItems, movieItems, tvItems, movieItems, animeItems]
          : [tvItems, animeItems, movieItems, animeItems, movieItems];

      for (const pool of slotPools) {
        const picked = pickUnused(pool, localUsed);
        if (picked) showcase.push(picked);
      }

      if (showcase.length < 5) {
        for (const item of unifiedItems) {
          if (showcase.length >= 5) break;
          if (!localUsed.has(item.key)) {
            localUsed.add(item.key);
            usedShowcaseKeys.add(item.key);
            showcase.push(item);
          }
        }
      }

      // Build the 15-poster carousel pool: initial 5 showcase posters + 10 additional mixed-media posters
      const carouselPosters: NichePosterItem[] = [...showcase.slice(0, 5)];
      for (const item of unifiedItems) {
        if (carouselPosters.length >= 15) break;
        if (!localUsed.has(item.key)) {
          localUsed.add(item.key);
          carouselPosters.push(item);
        }
      }

      const collectionData: NicheCollectionData = {
        niche,
        posters: showcase.slice(0, 5),
        carouselPosters,
        items: unifiedItems,
        counts: {
          total: unifiedItems.length,
          anime: animeItems.length,
          movies: movieItems.length,
          tv: tvItems.length,
        },
      };

      nicheDataCache.set(niche.id, collectionData);
      results[niche.id] = collectionData;
    }

    // Warm the initial 5 posters immediately and progressively preload the ~10 additional posters per niche
    if (typeof window !== 'undefined') {
      NICHE_CONFIGS.forEach((n) => {
        const col = results[n.id];
        col?.posters.forEach((p) => {
          preloadSinglePosterUrl(p.posterUrl).catch(() => {});
        });
      });

      setTimeout(() => {
        NICHE_CONFIGS.forEach((n, i) => {
          setTimeout(() => {
            preloadNicheCarouselImages(n.id).catch(() => {});
          }, i * 220);
        });
      }, 600);
    }

    return results;
  })();

  try {
    return await allNichesPromise;
  } finally {
    allNichesPromise = null;
  }
}

/**
 * Generates personalized mixed-media recommendations for the homepage "Suggested For You" section
 * based on the user's selected niches and watch history completion state.
 */
export async function getPersonalizedSuggestedItems(
  selectedNicheIds: string[],
  fallbackTrending: any[] = [],
  completedKeys: Set<string> = new Set()
): Promise<any[]> {
  if (!selectedNicheIds || selectedNicheIds.length === 0) {
    return fallbackTrending;
  }

  const collections = getCachedNicheCollections() || (await loadAllNicheCollections());
  const selectedPools: NichePosterItem[][] = [];

  for (const id of selectedNicheIds) {
    const col = collections[id];
    if (col && col.items.length > 0) {
      selectedPools.push(col.items);
    }
  }

  if (selectedPools.length === 0) {
    return fallbackTrending;
  }

  // Round-robin interleave across all selected niches so every chosen niche is represented evenly
  const interleavedNicheItems: any[] = [];
  const maxPoolLen = Math.max(...selectedPools.map((p) => p.length));

  for (let i = 0; i < maxPoolLen; i++) {
    for (const pool of selectedPools) {
      const posterItem = pool[i];
      if (!posterItem || !posterItem.rawItem) continue;

      const watchKey = `${posterItem.mediaType}_${posterItem.id}`;
      // Deprioritize / exclude already-completed items
      if (completedKeys.has(watchKey)) continue;

      const raw = posterItem.rawItem;
      if (raw.backdrop_path) {
        interleavedNicheItems.push(raw);
      }
    }
  }

  const dedupedNicheMatches = dedupeItems(interleavedNicheItems);
  if (dedupedNicheMatches.length === 0) {
    return fallbackTrending;
  }

  // Blend ~80% niche-matched mixed media with ~20% trending discovery items so the rail stays fresh
  const filteredDiscovery = (fallbackTrending || []).filter((item: any) => {
    if (!item || !item.id || !item.backdrop_path) return false;
    const type = item.source === 'anilist' ? 'anime' : item.media_type || (item.first_air_date ? 'tv' : 'movie');
    return !completedKeys.has(`${type}_${item.id}`);
  });

  const blended: any[] = [];
  let discoveryIdx = 0;

  for (let i = 0; i < dedupedNicheMatches.length; i++) {
    blended.push(dedupedNicheMatches[i]);
    if ((i + 1) % 4 === 0 && discoveryIdx < filteredDiscovery.length) {
      blended.push(filteredDiscovery[discoveryIdx]);
      discoveryIdx++;
    }
  }

  return dedupeItems(blended).slice(0, 24);
}
