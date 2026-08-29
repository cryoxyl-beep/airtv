const TVDB_API = 'https://api4.thetvdb.com/v4';
const TVDB_IMAGE_BASE = 'https://artworks.thetvdb.com'; 

let tvdbToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

export const getTvdbToken = async (): Promise<string> => {
  if (tvdbToken) return tvdbToken;
  if (tokenPromise) return tokenPromise;
  
  tokenPromise = (async () => {
    try {
      // @ts-ignore
      const apiKey = import.meta.env.VITE_TVDB_API_KEY || '83ebc05e-3618-442c-b90e-cd5b60817a77';
      const res = await fetch(`${TVDB_API}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ apikey: apiKey })
      });
      if (!res.ok) throw new Error("TVDB login failed");
      const data = await res.json();
      tvdbToken = data.data.token;
      return tvdbToken!;
    } catch (e) {
      console.error("Failed to get TVDB token", e);
      throw e;
    }
  })();
  return tokenPromise;
};

const tvdbEpisodeListCache = new Map<string, any[]>();

// Fetch all episodes for a TVDB series
export const fetchTVDBEpisodesForSeries = async (tvdbId: number): Promise<any[]> => {
  const cacheKey = `${tvdbId}`;
  if (tvdbEpisodeListCache.has(cacheKey)) return tvdbEpisodeListCache.get(cacheKey)!;
  
  try {
    const token = await getTvdbToken();
    let page = 0;
    let allEpisodes: any[] = [];
    
    // Fetch up to 5 pages
    while (page < 5) {
      const url = `${TVDB_API}/series/${tvdbId}/episodes/default/eng?page=${page}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) break;
      const data = await res.json();
      const episodes = data.data?.episodes || [];
      if (episodes.length === 0) break;
      
      allEpisodes = [...allEpisodes, ...episodes];
      
      if (!data.links || data.links.next === null || page >= data.links.last) {
        break;
      }
      page++;
    }
    
    tvdbEpisodeListCache.set(cacheKey, allEpisodes);
    return allEpisodes;
    
  } catch (e) {
    console.error("TVDB fetch failed", e);
    return [];
  }
};
