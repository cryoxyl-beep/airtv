const TVDB_API = 'https://api4.thetvdb.com/v4';

let tvdbToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

export const getTvdbToken = async (): Promise<string> => {
  if (tvdbToken) return tvdbToken;
  if (tokenPromise) return tokenPromise;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    const saved = sessionStorage.getItem('tvdb_jwt_token');
    if (saved) {
      tvdbToken = saved;
      return saved;
    }
  }
  
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
      if (tvdbToken && typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('tvdb_jwt_token', tvdbToken);
      }
      return tvdbToken!;
    } catch (e) {
      console.error("Failed to get TVDB token", e);
      throw e;
    } finally {
      tokenPromise = null;
    }
  })();
  return tokenPromise;
};

// Pre-warm TVDB token in background
getTvdbToken().catch(() => {});

const tvdbEpisodeListCache = new Map<string, any[]>();
const inFlightTvdb = new Map<string, Promise<any[]>>();

export const fetchTVDBEpisodesForSeries = async (tvdbId: number): Promise<any[]> => {
  const cacheKey = `tvdb_eps_v1_${tvdbId}`;
  if (tvdbEpisodeListCache.has(cacheKey)) return tvdbEpisodeListCache.get(cacheKey)!;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        tvdbEpisodeListCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (e) {
      // ignore
    }
  }

  if (inFlightTvdb.has(cacheKey)) return inFlightTvdb.get(cacheKey)!;

  const promise = (async () => {
    try {
      const token = await getTvdbToken();
      const url = `${TVDB_API}/series/${tvdbId}/episodes/default/eng?page=0`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      let allEpisodes: any[] = data.data?.episodes || [];

      // Only fetch page 1 in parallel if series has >500 episodes and next page exists
      if (data.links?.next && data.links?.last && data.links.last >= 1) {
        const maxExtraPage = Math.min(data.links.last, 2);
        const pagePromises = [];
        for (let p = 1; p <= maxExtraPage; p++) {
          pagePromises.push(
            fetch(`${TVDB_API}/series/${tvdbId}/episodes/default/eng?page=${p}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => (r.ok ? r.json() : null)).catch(() => null)
          );
        }
        const extraResults = await Promise.all(pagePromises);
        for (const extra of extraResults) {
          if (extra?.data?.episodes) {
            allEpisodes = [...allEpisodes, ...extra.data.episodes];
          }
        }
      }

      tvdbEpisodeListCache.set(cacheKey, allEpisodes);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(allEpisodes));
        } catch (e) {
          // ignore
        }
      }
      return allEpisodes;
    } catch (e) {
      console.error("TVDB fetch failed", e);
      return [];
    }
  })();

  inFlightTvdb.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightTvdb.delete(cacheKey);
  }
};
