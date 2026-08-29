const jikanCache = new Map<string, any>();
const JIKAN_API = 'https://api.jikan.moe/v4';

export const fetchJikanEpisodesList = async (malId: number) => {
  const cacheKey = `list-${malId}`;
  if (jikanCache.has(cacheKey)) {
    return jikanCache.get(cacheKey);
  }
  
  try {
    const res = await fetch(`${JIKAN_API}/anime/${malId}/episodes`);
    if (!res.ok) throw new Error("Jikan fetch failed");
    const data = await res.json();
    if (data && data.data) {
      jikanCache.set(cacheKey, data.data);
      return data.data; // Array of episodes
    }
  } catch (e) {
    return [];
  }
  return [];
};
