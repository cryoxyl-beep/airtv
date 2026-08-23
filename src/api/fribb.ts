let tmdbToAnilist = new Map<number, {id: number, type: string, season?: number}>();
let anilistToTmdb = new Map<number, {id: number, type: string, season?: number}>();
let isInitialized = false;
let initPromise: Promise<void> | null = null;

export const initFribb = async () => {
  if (isInitialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json');
      if (!response.ok) throw new Error('Failed to fetch Fribb mapping');
      
      const data = await response.json();
      
      for (const item of data) {
        if (item.anilist_id && item.themoviedb_id) {
          const tmdbId = item.themoviedb_id.tv || item.themoviedb_id.movie || (typeof item.themoviedb_id === 'number' ? item.themoviedb_id : null);
          const type = item.themoviedb_id.movie ? 'movie' : 'tv';
          const season = item.season?.tmdb;
          if (tmdbId) {
            anilistToTmdb.set(item.anilist_id, { id: tmdbId, type, season });
            tmdbToAnilist.set(tmdbId, { id: item.anilist_id, type, season });
          }
        }
      }
      isInitialized = true;
      console.log('Fribb mapping initialized with', anilistToTmdb.size, 'entries');
    } catch (e) {
      console.error('Failed to initialize Fribb mapping:', e);
    }
  })();
  
  return initPromise;
};

export const getTmdbId = async (anilistId: number): Promise<{ id: number, type: string, season?: number } | undefined> => {
  await initFribb();
  return anilistToTmdb.get(anilistId);
};

export const getAnilistId = (tmdbId: number): number | undefined => {
  return tmdbToAnilist.get(tmdbId)?.id;
};
