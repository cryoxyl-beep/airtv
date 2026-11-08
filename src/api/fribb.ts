
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
Object.entries(STATIC_MAPPINGS).forEach(([idStr, val]) => {
  const anilistId = Number(idStr);
  anilistToMapping.set(anilistId, {
    anilistId,
    mappingFound: true,
    type: val.type || 'TV',
    ...val
  });
});

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export const preloadFribbMapping = async () => {
  if (isInitialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json');
      if (!response.ok) throw new Error('Failed to fetch Fribb mapping');
      const data = await response.json();
      
      for (const item of data) {
        if (item.anilist_id) {
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
      isInitialized = true;
      console.log('Fribb mapping initialized with', anilistToMapping.size, 'entries');
    } catch (e) {
      console.error('Failed to initialize Fribb mapping:', e);
    }
  })();
  
  return initPromise;
};

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
