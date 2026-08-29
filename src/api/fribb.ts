
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

let anilistToMapping = new Map<number, FribbMapping>();
let isInitialized = false;
let initPromise: Promise<void> | null = null;

export const preloadFribbMapping = async () => {
  if (isInitialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      // 1. Check local storage cache first to save download time
      const cacheKey = 'fribb_mapping_v1';
      const cached = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(cacheKey) : null;
      
      let data;
      if (cached) {
        data = JSON.parse(cached);
      } else {
        const response = await fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json');
        if (!response.ok) throw new Error('Failed to fetch Fribb mapping');
        data = await response.json();
        try {
          if (typeof window !== 'undefined' && window.localStorage) localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {
          // ignore quota errors
        }
      }
      
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
