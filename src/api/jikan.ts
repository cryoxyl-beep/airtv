const jikanCache = new Map<string, any[]>();
const inFlightJikan = new Map<string, Promise<any[]>>();
const JIKAN_API = 'https://api.jikan.moe/v4';

export const fetchJikanEpisodesList = async (malId: number): Promise<any[]> => {
  const cacheKey = `jikan_eps_v1_${malId}`;
  if (jikanCache.has(cacheKey)) {
    return jikanCache.get(cacheKey)!;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        jikanCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (e) {
      // ignore
    }
  }

  if (inFlightJikan.has(cacheKey)) {
    return inFlightJikan.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`${JIKAN_API}/anime/${malId}/episodes`);
      if (!res.ok) throw new Error("Jikan fetch failed");
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        jikanCache.set(cacheKey, data.data);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data.data));
          } catch (e) {
            // ignore
          }
        }
        return data.data;
      }
    } catch (e) {
      // ignore
    }
    return [];
  })();

  inFlightJikan.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightJikan.delete(cacheKey);
  }
};
