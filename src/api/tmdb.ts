const API_READ_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYmM3ZjM4ZTEwNzBmMWI4NzM2MDc4OTM4MDA1OThkOSIsIm5iZiI6MTcxNzIxNDAzNi4wMzIsInN1YiI6IjY2NWE5YjU0M2MzMmNiMWFiZmFmMGFmOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.BEKlgnL8r52GcU2Fb8QXcp3W9-giqabR8AtbBlGDmU0';

const BASE_URL = 'https://api.themoviedb.org/3';
export const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';
export const IMAGE_BASE_URL_W500 = 'https://image.tmdb.org/t/p/w500';
export const IMAGE_BASE_URL_W300 = 'https://image.tmdb.org/t/p/w300';


export const isAnime = (item: any): boolean => {
  if (!item) return false;
  // If it comes from our AniList source, it's anime
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
  try {
    const res = await fetch(`${BASE_URL}/trending/all/day?language=en-US`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    return data;
  } catch (error) {
    console.warn("fetchTrending failed:", error);
    return { results: [] };
  }
};

export const fetchTop10 = async () => {
  try {
    const res = await fetch(`${BASE_URL}/tv/popular?language=en-US&page=1`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
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

export const fetchDetails = async (id: number, type: 'movie' | 'tv' = 'tv', retries = 2) => {
  try {
    const res = await fetch(`${BASE_URL}/${type}/${id}?append_to_response=images,credits,content_ratings,release_dates&include_image_language=en,null`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      console.warn(`fetchDetails failed, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 500));
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
    
    // Prefer official YouTube trailers
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

const LOGO_CACHE_VERSION = 'v1';
const inFlightLogos = new Map<string, Promise<string | null>>();

interface CachedLogo {
  url: string | null;
  source: string;
  version: string;
  timestamp: number;
}

export const getCachedLogo = (item: any): string | null => {
  if (item?.source === 'anilist' && item.tmdb_id) {
    item = { ...item, id: item.tmdb_id };
  }

  if (!item) return null;
  const baseType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const type = baseType === 'anime' ? (item.anime_format || 'tv') : baseType;
  const cacheKey = `hd_logo_${type}_${item.id}`;
  
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed: CachedLogo = JSON.parse(cachedData);
        if (parsed && parsed.version === LOGO_CACHE_VERSION) {
          return parsed.url;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
};

export const resolveLogo = async (item: any): Promise<string | null> => {
  if (item?.source === 'anilist') {
    if (!item.tmdb_id) {
      return null;
    }
    item = { ...item, id: item.tmdb_id };
  }
  if (!item) return null;
  
  const baseType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const type = baseType === 'anime' ? (item.tmdb_type || 'tv') : baseType;
  const cacheKey = `hd_logo_${type}_${item.id}`;
  const isDev = (import.meta as any).env?.DEV === true;
  
  // 1. Check LocalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed: CachedLogo = JSON.parse(cachedData);
        if (parsed && parsed.version === LOGO_CACHE_VERSION) {
          if (isDev) console.log(`Logo cache hit: ${cacheKey}`);
          return parsed.url;
        } else {
          // Version mismatch or invalid cache, clear it
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {
      if (isDev) console.warn(`Failed to read from localStorage for ${cacheKey}`, e);
    }
  }
  
  // 2. Check if already in flight
  if (inFlightLogos.has(cacheKey)) {
    if (isDev) console.log(`Logo request already in flight: ${cacheKey}`);
    return inFlightLogos.get(cacheKey)!;
  }
  
  if (isDev) console.log(`Logo cache miss: ${cacheKey}`);
  
  // 3. Create fetch promise and store it
  const fetchPromise = (async () => {
    let finalUrl: string | null = null;
    let source = 'none';
    
    // TMDB Logo Check
    let tmdbLogo: string | null = null;
    const logos = item.images?.logos || [];
    if (logos.length > 0) {
      logos.sort((a: any, b: any) => b.vote_average - a.vote_average);
      const enLogo = logos.find((l: any) => l.iso_639_1 === 'en');
      tmdbLogo = enLogo?.file_path || logos[0]?.file_path;
    }
    
    if (!tmdbLogo) {
      try {
        const res = await fetch(`${BASE_URL}/${type}/${item.id}/images?include_image_language=en,null`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          const fetchedLogos = data.logos || [];
          if (fetchedLogos.length > 0) {
            fetchedLogos.sort((a: any, b: any) => b.vote_average - a.vote_average);
            const enLogo = fetchedLogos.find((l: any) => l.iso_639_1 === 'en');
            tmdbLogo = enLogo?.file_path || fetchedLogos[0]?.file_path;
          }
        }
      } catch (error) {
        // ignore
      }
    }
    
    if (tmdbLogo) {
      finalUrl = `${IMAGE_BASE_URL}${tmdbLogo}`;
      source = 'TMDB';
      if (isDev) console.log(`Logo fetched from TMDB: ${cacheKey}`);
    }
    
    // Fanart.tv Fallback
    if (!finalUrl) {
      const FANART_API_KEY = (import.meta as any).env.VITE_FANART_API_KEY || '[PASTE_FANART_API_KEY_HERE]';
      if (type === 'movie') {
        try {
          const res = await fetch(`https://webservice.fanart.tv/v3.2/movies/${item.id}?api_key=${FANART_API_KEY}`);
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
        const tvdbId = item.external_ids?.tvdb_id || item.tvdb_id;
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
      
      if (finalUrl && source === 'Fanart.tv' && isDev) {
        console.log(`Logo fetched from Fanart.tv: ${cacheKey}`);
      }
    }
    
    // Cache the result
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheData: CachedLogo = {
          url: finalUrl,
          source,
          version: LOGO_CACHE_VERSION,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        if (isDev) console.log(`Logo saved to cache: ${cacheKey}`);
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

export const fetchByGenre = async (genreId: number) => {
  try {
    const res = await fetch(`${BASE_URL}/discover/movie?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    return data;
  } catch (error) {
    console.warn(`fetchByGenre failed for genre ${genreId}:`, error);
    return { results: [] };
  }
};

export const fetchTVByGenre = async (genreId: number) => {
  try {
    const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    return data;
  } catch (error) {
    console.warn(`fetchTVByGenre failed for genre ${genreId}:`, error);
    return { results: [] };
  }
};


export const fetchTVSeason = async (tvId: number, seasonNumber: number, retries = 2) => {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?language=en-US`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      console.warn(`fetchTVSeason failed for tv ${tvId} season ${seasonNumber}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 500));
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
  try {
    const res = await fetch(`${BASE_URL}/discover/movie?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&watch_region=US&with_watch_providers=${providerId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    return data;
  } catch (error) {
    console.warn(`fetchByProvider failed for provider ${providerId}:`, error);
    return { results: [] };
  }
};

export const fetchTVByProvider = async (providerId: number) => {
  try {
    const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&watch_region=US&with_watch_providers=${providerId}`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
    }
    return data;
  } catch (error) {
    console.warn(`fetchTVByProvider failed for provider ${providerId}:`, error);
    return { results: [] };
  }
};
