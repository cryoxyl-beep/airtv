const API_READ_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYmM3ZjM4ZTEwNzBmMWI4NzM2MDc4OTM4MDA1OThkOSIsIm5iZiI6MTcxNzIxNDAzNi4wMzIsInN1YiI6IjY2NWE5YjU0M2MzMmNiMWFiZmFmMGFmOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.BEKlgnL8r52GcU2Fb8QXcp3W9-giqabR8AtbBlGDmU0';

const BASE_URL = 'https://api.themoviedb.org/3';
export const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
export const IMAGE_BASE_URL_ORIGINAL = 'https://image.tmdb.org/t/p/original';
export const IMAGE_BASE_URL_W500 = 'https://image.tmdb.org/t/p/w500';
export const IMAGE_BASE_URL_W300 = 'https://image.tmdb.org/t/p/w300';

const LOGO_CACHE_VERSION = 'v2';
const memoryLogoCache = new Map<string, string | null>();
const inFlightLogos = new Map<string, Promise<string | null>>();
const responseCache = new Map<string, any>();

interface CachedLogo {
  url: string | null;
  source: string;
  version: string;
  timestamp: number;
}

const normalizeLogoUrl = (url: string | null): string | null => {
  if (!url) return null;
  // Convert massive /t/p/original PNG logos to fast HD /t/p/w500 transparent PNGs
  if (url.startsWith('https://image.tmdb.org/t/p/original/')) {
    return url.replace('https://image.tmdb.org/t/p/original/', 'https://image.tmdb.org/t/p/w500/');
  }
  return url;
};

const getLogoCacheKey = (item: any): { cacheKey: string; type: string; id: number | string } | null => {
  if (!item) return null;
  const targetId = item.source === 'anilist' ? item.tmdb_id : item.id;
  if (!targetId) return null;
  const baseType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const type = baseType === 'anime' ? (item.tmdb_type || item.anime_format || 'tv') : baseType;
  return {
    cacheKey: `hd_logo_${type}_${targetId}`,
    type,
    id: targetId
  };
};

export const extractBestLogoPath = (logos: any[]): string | null => {
  if (!Array.isArray(logos) || logos.length === 0) return null;
  const sorted = [...logos].sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0));
  const enLogo = sorted.find((l: any) => l.iso_639_1 === 'en');
  const nullLangLogo = sorted.find((l: any) => l.iso_639_1 === null || l.iso_639_1 === '');
  return enLogo?.file_path || nullLangLogo?.file_path || sorted[0]?.file_path || null;
};

export const primeLogoCache = (type: string, id: number | string, logoFilePathOrUrl: string | null) => {
  if (!id || !type) return;
  const cacheKey = `hd_logo_${type}_${id}`;
  const finalUrl = logoFilePathOrUrl
    ? (logoFilePathOrUrl.startsWith('http') ? normalizeLogoUrl(logoFilePathOrUrl) : `${IMAGE_BASE_URL_W500}${logoFilePathOrUrl}`)
    : null;

  memoryLogoCache.set(cacheKey, finalUrl);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cacheData: CachedLogo = {
        url: finalUrl,
        source: finalUrl ? 'TMDB' : 'none',
        version: LOGO_CACHE_VERSION,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
      // ignore storage quota errors
    }
  }
};

export const hasCachedLogoEntry = (item: any): boolean => {
  const info = getLogoCacheKey(item);
  if (!info) return true; // If anime has no tmdb_id, no logo can be fetched, so treat as resolved
  if (item?.logo_path !== undefined) return true;
  if (item?.images?.logos) return true;
  if (memoryLogoCache.has(info.cacheKey)) return true;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cachedData = localStorage.getItem(info.cacheKey);
      if (cachedData) {
        const parsed: CachedLogo = JSON.parse(cachedData);
        if (parsed && (parsed.version === LOGO_CACHE_VERSION || parsed.version === 'v1')) {
          const normalized = normalizeLogoUrl(parsed.url);
          memoryLogoCache.set(info.cacheKey, normalized);
          return true;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return false;
};

export const getCachedLogo = (item: any): string | null => {
  if (!item) return null;

  // 1. Direct pre-attached logo on item
  if (item.logo_path) {
    const url = item.logo_path.startsWith('http')
      ? normalizeLogoUrl(item.logo_path)
      : `${IMAGE_BASE_URL_W500}${item.logo_path}`;
    const info = getLogoCacheKey(item);
    if (info && !memoryLogoCache.has(info.cacheKey)) {
      memoryLogoCache.set(info.cacheKey, url);
    }
    return url;
  }

  // 2. Pre-attached images.logos array on item (e.g. from fetchDetails)
  if (item.images?.logos) {
    const filePath = extractBestLogoPath(item.images.logos);
    const info = getLogoCacheKey(item);
    if (info) {
      primeLogoCache(info.type, info.id, filePath);
    }
    return filePath ? `${IMAGE_BASE_URL_W500}${filePath}` : null;
  }

  const info = getLogoCacheKey(item);
  if (!info) return null;

  // 3. Fast in-memory map check
  if (memoryLogoCache.has(info.cacheKey)) {
    return memoryLogoCache.get(info.cacheKey)!;
  }

  // 4. LocalStorage check
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cachedData = localStorage.getItem(info.cacheKey);
      if (cachedData) {
        const parsed: CachedLogo = JSON.parse(cachedData);
        if (parsed && (parsed.version === LOGO_CACHE_VERSION || parsed.version === 'v1')) {
          const normalized = normalizeLogoUrl(parsed.url);
          memoryLogoCache.set(info.cacheKey, normalized);
          return normalized;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
};

export const resolveLogo = async (item: any): Promise<string | null> => {
  if (!item) return null;

  // Check synchronous cache first
  if (hasCachedLogoEntry(item)) {
    return getCachedLogo(item);
  }

  const info = getLogoCacheKey(item);
  if (!info) return null;
  const { cacheKey, type, id } = info;

  if (inFlightLogos.has(cacheKey)) {
    return inFlightLogos.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    let finalUrl: string | null = null;
    let source = 'none';

    let tmdbLogo: string | null = extractBestLogoPath(item.images?.logos || []);

    if (!tmdbLogo) {
      try {
        const res = await fetch(`${BASE_URL}/${type}/${id}/images?include_image_language=en,null`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          tmdbLogo = extractBestLogoPath(data.logos || []);
        }
      } catch (error) {
        // ignore
      }
    }

    if (tmdbLogo) {
      finalUrl = `${IMAGE_BASE_URL_W500}${tmdbLogo}`;
      source = 'TMDB';
    }

    // Optional Fanart.tv Fallback only if a real key is configured
    const FANART_API_KEY = (import.meta as any).env?.VITE_FANART_API_KEY;
    if (!finalUrl && FANART_API_KEY && FANART_API_KEY !== '[PASTE_FANART_API_KEY_HERE]') {
      if (type === 'movie') {
        try {
          const res = await fetch(`https://webservice.fanart.tv/v3.2/movies/${id}?api_key=${FANART_API_KEY}`);
          if (res.ok) {
            const data = await res.json();
            const hdlogos = data.hdmovielogo || [];
            if (hdlogos.length > 0) {
              const enLogo = hdlogos.find((l: any) => l.lang === 'en');
              finalUrl = enLogo?.url || hdlogos[0]?.url;
              if (finalUrl) source = 'Fanart.tv';
            }
          }
        } catch (e) {
          // ignore
        }
      } else if (type === 'tv') {
        const tvdbId = item.external_ids?.tvdb_id || item.tvdb_id || item.fribb_mapping?.tvdbId;
        if (tvdbId) {
          try {
            const res = await fetch(`https://webservice.fanart.tv/v3.2/tv/${tvdbId}?api_key=${FANART_API_KEY}`);
            if (res.ok) {
              const data = await res.json();
              const hdtvlogos = data.hdtvlogo || [];
              if (hdtvlogos.length > 0) {
                const enLogo = hdtvlogos.find((l: any) => l.lang === 'en');
                finalUrl = enLogo?.url || hdtvlogos[0]?.url;
                if (finalUrl) source = 'Fanart.tv';
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    memoryLogoCache.set(cacheKey, finalUrl);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheData: CachedLogo = {
          url: finalUrl,
          source,
          version: LOGO_CACHE_VERSION,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        // ignore
      }
    }

    return finalUrl;
  })();

  inFlightLogos.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightLogos.delete(cacheKey);
  }
};

export const preloadLogosForItems = (items: any[]) => {
  if (!Array.isArray(items)) return;
  items.forEach((item) => {
    if (!item) return;
    if (!hasCachedLogoEntry(item)) {
      resolveLogo(item).catch(() => {});
    }
  });
};

export const isAnime = (item: any): boolean => {
  if (!item) return false;
  if (item.source === 'anilist') return false;
  
  const isAnimation = item.genre_ids?.includes(16) || item.genres?.some((g: any) => g.id === 16);
  const isJP = item.origin_country?.includes('JP') || item.original_language === 'ja';
  
  if (isAnimation && isJP) return true;
  if (item.original_language === 'ja' && (item.media_type === 'tv' || item.type === 'Scripted')) return true;
  
  return false;
};

export const filterOutAnime = (results: any[]): any[] => {
  if (!Array.isArray(results)) return [];
  return results.filter(item => !isAnime(item));
};

const fetchOptions = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${API_READ_TOKEN}`
  }
};

export const fetchTrending = async () => {
  const cacheKey = 'trending_all_day';
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/trending/all/day?language=en-US`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    responseCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn("fetchTrending failed:", error);
    return { results: [] };
  }
};

export const fetchTop10 = async () => {
  const cacheKey = 'tv_popular_1';
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/tv/popular?language=en-US&page=1`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    responseCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn("fetchTop10 failed:", error);
    return { results: [] };
  }
};

export const fetchAnime = async () => {
  try {
    const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=16&origin_country=JP`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    return await res.json();
  } catch (error) {
    console.warn("fetchAnime failed:", error);
    return { results: [] };
  }
};

export const fetchAllTimeFavorites = async () => {
  try {
    const res = await fetch(`${BASE_URL}/movie/top_rated?language=en-US&page=1`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    return data;
  } catch (error) {
    console.warn("fetchAllTimeFavorites failed:", error);
    return { results: [] };
  }
};

export const fetchDetails = async (id: number, type: 'movie' | 'tv' = 'tv', retries = 2): Promise<any> => {
  const cacheKey = `details_${type}_${id}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/${type}/${id}?append_to_response=images,credits,content_ratings,release_dates&include_image_language=en,null`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data) {
      const bestLogo = extractBestLogoPath(data.images?.logos || []);
      primeLogoCache(type, id, bestLogo);
      data.logo_path = bestLogo ? `${IMAGE_BASE_URL_W500}${bestLogo}` : null;
      responseCache.set(cacheKey, data);
    }
    return data;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return fetchDetails(id, type, retries - 1);
    }
    console.warn("fetchDetails failed:", error);
    throw error;
  }
};

const trailerCache = new Map<string, string | null>();

export const fetchTrailer = async (id: number, type: 'movie' | 'tv' = 'tv'): Promise<string | null> => {
  const cacheKey = `${type}_${id}`;
  if (trailerCache.has(cacheKey)) {
    return trailerCache.get(cacheKey)!;
  }
  
  try {
    const res = await fetch(`${BASE_URL}/${type}/${id}/videos?language=en-US`, fetchOptions);
    const data = await res.json();
    const videos = data.results || [];
    
    const officialTrailer = videos.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
    );
    const anyTrailer = videos.find(
      (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
    );
    const anyVideo = videos.find((v: any) => v.site === 'YouTube');
    
    const trailerKey = officialTrailer?.key || anyTrailer?.key || anyVideo?.key || null;
    
    trailerCache.set(cacheKey, trailerKey);
    return trailerKey;
  } catch (error) {
    return null;
  }
};

export const fetchByGenre = async (genreId: number) => {
  const cacheKey = `movie_genre_${genreId}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/discover/movie?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    responseCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`fetchByGenre failed for genre ${genreId}:`, error);
    return { results: [] };
  }
};

export const fetchTVByGenre = async (genreId: number) => {
  const cacheKey = `tv_genre_${genreId}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    responseCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`fetchTVByGenre failed for genre ${genreId}:`, error);
    return { results: [] };
  }
};

export const fetchTVSeason = async (tvId: number, seasonNumber: number, retries = 2): Promise<any> => {
  const cacheKey = `tv_season_${tvId}_${seasonNumber}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?language=en-US`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    responseCache.set(cacheKey, data);
    return data;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return fetchTVSeason(tvId, seasonNumber, retries - 1);
    }
    console.warn(`fetchTVSeason failed for tv ${tvId} season ${seasonNumber}:`, error);
    throw error;
  }
};

let cachedProviders: any[] = [];
export const fetchProviderLogos = async () => {
  if (cachedProviders.length > 0) return cachedProviders;
  try {
    const res = await fetch(`${BASE_URL}/watch/providers/movie?language=en-US`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    cachedProviders = data.results || [];
    return cachedProviders;
  } catch (error) {
    console.warn("fetchProviderLogos failed:", error);
    return [];
  }
};

export const fetchByProvider = async (providerId: number) => {
  const cacheKey = `provider_movie_${providerId}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/discover/movie?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&watch_region=US&with_watch_providers=${providerId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    responseCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`fetchByProvider failed for provider ${providerId}:`, error);
    return { results: [] };
  }
};

export const fetchTVByProvider = async (providerId: number) => {
  const cacheKey = `provider_tv_${providerId}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  try {
    const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&watch_region=US&with_watch_providers=${providerId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    responseCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`fetchTVByProvider failed for provider ${providerId}:`, error);
    return { results: [] };
  }
};

export const searchMovies = async (query: string) => {
  try {
    const res = await fetch(`${BASE_URL}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
      data.results.forEach((r: any) => { r.media_type = 'movie'; });
    }
    return data;
  } catch (error) {
    console.warn("searchMovies failed:", error);
    return { results: [] };
  }
};

export const searchTV = async (query: string) => {
  try {
    const res = await fetch(`${BASE_URL}/search/tv?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
      data.results.forEach((r: any) => { r.media_type = 'tv'; });
    }
    return data;
  } catch (error) {
    console.warn("searchTV failed:", error);
    return { results: [] };
  }
};
