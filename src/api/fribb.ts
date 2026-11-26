
import { indexedDbCache } from '../lib/cache/indexedDbCache';

const FRIBB_LIST_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json';
export const FRIBB_CACHE_KEY = 'anime-list-mini:v1';

export interface FribbMapping {
  anilistId: number;
  malId?: number;
  tvdbId?: number;
  tmdbTvId?: number;
  tmdbMovieId?: number;
  seasonMappingTVDB?: number;
  seasonMappingTMDB?: number;
  mappingFound: boolean;
  type: string;
}

const STATIC_MAPPINGS: Record<number, Partial<FribbMapping>> = {
  140960: { tmdbTvId: 120089, tvdbId: 403816, type: 'TV' }, // SPY x FAMILY Part 1
  142838: { tmdbTvId: 120089, tvdbId: 403816, type: 'TV', seasonMappingTVDB: 1, seasonMappingTMDB: 1 }, // SPY x FAMILY Part 2
  158870: { tmdbTvId: 120089, tvdbId: 403816, type: 'TV', seasonMappingTVDB: 2, seasonMappingTMDB: 2 }, // SPY x FAMILY Season 2
  158871: { tmdbMovieId: 1062807, type: 'MOVIE' }, // SPY x FAMILY CODE: White
  269: { tmdbTvId: 30984, tvdbId: 79169, type: 'TV' }, // Bleach
  114446: { tmdbTvId: 30984, tvdbId: 79169, type: 'TV', seasonMappingTVDB: 17 }, // Bleach: Thousand-Year Blood War
  159322: { tmdbTvId: 30984, tvdbId: 79169, type: 'TV', seasonMappingTVDB: 17 }, // Bleach: TYBW Part 2
  16498: { tmdbTvId: 1429, tvdbId: 267440, type: 'TV' }, // Attack on Titan
  113415: { tmdbTvId: 95479, tvdbId: 388339, type: 'TV' }, // Jujutsu Kaisen
  145064: { tmdbTvId: 95479, tvdbId: 388339, type: 'TV', seasonMappingTVDB: 2 }, // Jujutsu Kaisen Season 2
};

let anilistToMapping = new Map<number, FribbMapping>();

function seedStaticMappings(): void {
  Object.entries(STATIC_MAPPINGS).forEach(([idStr, val]) => {
    const anilistId = Number(idStr);
    anilistToMapping.set(anilistId, {
      anilistId,
      mappingFound: true,
      type: val.type || 'TV',
      ...val
    });
  });
}

seedStaticMappings();

let isInitialized = false;
let initPromise: Promise<void> | null = null;
let backgroundRefreshPromise: Promise<void> | null = null;

export function isValidFribbDataset(data: unknown): data is Array<Record<string, any>> {
  if (!Array.isArray(data) || data.length === 0) return false;
  let validAnilistCount = 0;
  const sampleLimit = Math.min(data.length, 25);
  for (let i = 0; i < sampleLimit; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    if (typeof item.anilist_id === 'number' && Number.isFinite(item.anilist_id) && item.anilist_id > 0) {
      validAnilistCount++;
    }
  }
  return validAnilistCount > 0;
}

function hydrateFribbMappingsFromData(data: Array<Record<string, any>>): void {
  for (const item of data) {
    if (item && typeof item.anilist_id === 'number' && Number.isFinite(item.anilist_id) && item.anilist_id > 0) {
      const mapping: FribbMapping = {
        anilistId: item.anilist_id,
        malId: item.mal_id,
        tvdbId: item.tvdb_id,
        mappingFound: !!item.themoviedb_id,
        type: item.type || 'TV'
      };

      if (item.themoviedb_id) {
        if (typeof item.themoviedb_id === 'number') {
          // Legacy/fallback
          if (item.type === 'MOVIE') {
            mapping.tmdbMovieId = item.themoviedb_id;
          } else {
            mapping.tmdbTvId = item.themoviedb_id;
          }
        } else {
          if (item.themoviedb_id.tv) mapping.tmdbTvId = item.themoviedb_id.tv;
          if (item.themoviedb_id.movie) {
            mapping.tmdbMovieId = Array.isArray(item.themoviedb_id.movie)
              ? item.themoviedb_id.movie[0]
              : item.themoviedb_id.movie;
          }
        }
      }

      if (item.season?.tmdb) {
        mapping.seasonMappingTMDB = item.season.tmdb;
      }
      if (item.season?.tvdb) {
        mapping.seasonMappingTVDB = item.season.tvdb;
      }

      anilistToMapping.set(item.anilist_id, mapping);
    }
  }
}

async function fetchAndPersistFribbDataset(): Promise<boolean> {
  try {
    const response = await fetch(FRIBB_LIST_URL);
    if (!response.ok) throw new Error('Failed to fetch Fribb mapping');
    const data = await response.json();
    if (!isValidFribbDataset(data)) {
      throw new Error('Invalid Fribb mapping dataset structure');
    }

    hydrateFribbMappingsFromData(data);
    isInitialized = true;

    void indexedDbCache.set('fribb', FRIBB_CACHE_KEY, data, {
      validate: isValidFribbDataset,
    });

    return true;
  } catch (e) {
    console.error('Failed to initialize Fribb mapping:', e);
    return false;
  }
}

function triggerFribbBackgroundRefresh(): void {
  if (backgroundRefreshPromise) return;
  backgroundRefreshPromise = fetchAndPersistFribbDataset()
    .then(() => undefined)
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

export const preloadFribbMapping = async () => {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const cached = await indexedDbCache.get<Array<Record<string, any>>>('fribb', FRIBB_CACHE_KEY, {
        validate: isValidFribbDataset,
      });

      if (cached) {
        hydrateFribbMappingsFromData(cached.value);
        isInitialized = true;
        if (cached.status === 'stale') {
          triggerFribbBackgroundRefresh();
        }
        return;
      }
    } catch {
      // Fall back to network fetch if IndexedDB fails
    }

    await fetchAndPersistFribbDataset();
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
};

export function resetFribbClientCache(): void {
  anilistToMapping = new Map<number, FribbMapping>();
  seedStaticMappings();
  isInitialized = false;
  initPromise = null;
  backgroundRefreshPromise = null;
}

export const resolveAnimeMapping = async (anilistId: number): Promise<FribbMapping> => {
  await preloadFribbMapping();
  const mapping = anilistToMapping.get(anilistId);
  if (mapping) {
    return mapping;
  }
  return {
    anilistId,
    mappingFound: false,
    type: 'TV'
  };
};

