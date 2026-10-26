import { resolveAnimeMapping } from './fribb';

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
const inFlightRequests = new Map<string, Promise<any>>();
const seedItemStore = new Map<string, any>();
const preloadedImageUrls = new Set<string>();

interface CachedLogo {
  url: string | null;
  source: string;
  version: string;
  timestamp: number;
}

export const preloadImageUrl = (url: string | null | undefined): Promise<void> => {
  if (!url || typeof window === 'undefined') return Promise.resolve();
  if (preloadedImageUrls.has(url)) return Promise.resolve();
  preloadedImageUrls.add(url);

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
};

export const preloadImageUrls = async (urls: (string | null | undefined)[], timeoutMs = 900): Promise<void> => {
  const valid = urls.filter((u): u is string => Boolean(u));
  if (valid.length === 0) return;

  await Promise.race([
    Promise.all(valid.map(u => preloadImageUrl(u))),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
  ]);
};

export const setSeedItem = (type: string, id: number | string, item: any) => {
  if (!id || !item) return;
  const key = `${type}_${id}`;
  const existing = seedItemStore.get(key);
  seedItemStore.set(key, existing ? { ...existing, ...item } : item);
};

export const getSeedItem = (type: string, id: number | string): any | null => {
  if (!id) return null;
  const detailsKey = `details_${type}_${id}`;
  if (responseCache.has(detailsKey)) return responseCache.get(detailsKey);
  return seedItemStore.get(`${type}_${id}`) || null;
};

export const indexSeedItems = (items: any[], defaultType?: string) => {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!item || !item.id) continue;
    const type = item.source === 'anilist'
      ? 'anime'
      : (item.media_type || defaultType || (item.first_air_date ? 'tv' : 'movie'));
    setSeedItem(type, item.id, item);
  }
};

const normalizeLogoUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith('https://image.tmdb.org/t/p/original/')) {
    return url.replace('https://image.tmdb.org/t/p/original/', 'https://image.tmdb.org/t/p/w500/');
  }
  return url;
};

const getLogoCacheKey = (item: any): { cacheKey: string; type: string; id: number | string } | null => {
  if (!item) return null;
  const targetId = item.source === 'anilist'
    ? (item.tmdb_id || item.fribb_mapping?.tmdbTvId || item.fribb_mapping?.tmdbMovieId)
    : item.id;
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
  
  // 1. Prefer English logo
  const enLogo = sorted.find((l: any) => l.iso_639_1 === 'en');
  if (enLogo?.file_path) return enLogo.file_path;

  // 2. Next, null or empty language (common for textless/universal logos)
  const nullLangLogo = sorted.find((l: any) => !l.iso_639_1 || l.iso_639_1 === 'null' || l.iso_639_1 === '');
  if (nullLangLogo?.file_path) return nullLangLogo.file_path;

  // 3. Next, Japanese logo (common for official anime title clear logos)
  const jaLogo = sorted.find((l: any) => l.iso_639_1 === 'ja');
  if (jaLogo?.file_path) return jaLogo.file_path;

  // 4. Any logo with highest votes
  return sorted[0]?.file_path || null;
};

export const primeLogoCache = (type: string, id: number | string, logoFilePathOrUrl: string | null) => {
  if (!id || !type) return;
  const cacheKey = `hd_logo_${type}_${id}`;
  const finalUrl = logoFilePathOrUrl
    ? (logoFilePathOrUrl.startsWith('http') ? normalizeLogoUrl(logoFilePathOrUrl) : `${IMAGE_BASE_URL_W500}${logoFilePathOrUrl}`)
    : null;

  if (finalUrl) {
    memoryLogoCache.set(cacheKey, finalUrl);
    preloadImageUrl(finalUrl);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheData: CachedLogo = {
          url: finalUrl,
          source: 'TMDB',
          version: LOGO_CACHE_VERSION,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        // ignore storage quota errors
      }
    }
  }
};

export const hasCachedLogoEntry = (item: any): boolean => {
  return Boolean(getCachedLogo(item));
};

export const getCachedLogo = (item: any): string | null => {
  if (!item) return null;

  if (typeof item.logo_path === 'string' && item.logo_path.length > 0) {
    const url = item.logo_path.startsWith('http')
      ? normalizeLogoUrl(item.logo_path)
      : `${IMAGE_BASE_URL_W500}${item.logo_path}`;
    const info = getLogoCacheKey(item);
    if (info && !memoryLogoCache.has(info.cacheKey)) {
      memoryLogoCache.set(info.cacheKey, url);
    }
    return url;
  }

  if (item.images?.logos) {
    const filePath = extractBestLogoPath(item.images.logos);
    if (filePath) {
      const info = getLogoCacheKey(item);
      if (info) {
        primeLogoCache(info.type, info.id, filePath);
      }
      return `${IMAGE_BASE_URL_W500}${filePath}`;
    }
  }

  const info = getLogoCacheKey(item);
  if (!info) return null;

  if (memoryLogoCache.has(info.cacheKey)) {
    return memoryLogoCache.get(info.cacheKey)!;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cachedData = localStorage.getItem(info.cacheKey);
      if (cachedData) {
        const parsed: CachedLogo = JSON.parse(cachedData);
        if (parsed && (parsed.version === LOGO_CACHE_VERSION || parsed.version === 'v1')) {
          if (typeof parsed.url === 'string' && parsed.url.length > 0) {
            const normalized = normalizeLogoUrl(parsed.url);
            memoryLogoCache.set(info.cacheKey, normalized);
            return normalized;
          }
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

  if (typeof item.logo_path === 'string' && item.logo_path.length > 0) {
    const url = item.logo_path.startsWith('http')
      ? normalizeLogoUrl(item.logo_path)
      : `${IMAGE_BASE_URL_W500}${item.logo_path}`;
    return url;
  }

  if (item.images?.logos) {
    const filePath = extractBestLogoPath(item.images.logos);
    if (filePath) {
      const info = getLogoCacheKey(item);
      if (info) primeLogoCache(info.type, info.id, filePath);
      return `${IMAGE_BASE_URL_W500}${filePath}`;
    }
  }

  let info = getLogoCacheKey(item);
  if (!info && item.source === 'anilist') {
    try {
      const mapping = await resolveAnimeMapping(item.id);
      if (mapping) {
        if (mapping.tmdbTvId) {
          item.tmdb_id = mapping.tmdbTvId;
          item.tmdb_type = 'tv';
        } else if (mapping.tmdbMovieId) {
          item.tmdb_id = mapping.tmdbMovieId;
          item.tmdb_type = 'movie';
        }
        item.fribb_mapping = mapping;
        info = getLogoCacheKey(item);
      }
    } catch (e) {
      // ignore
    }

    if (!info) {
      const rawTitle = item.title || item.name || '';
      if (rawTitle) {
        try {
          const cleanQuery = rawTitle.replace(/[^\w\s]/g, ' ').trim();
          const searchRes = await fetch(`${BASE_URL}/search/multi?query=${encodeURIComponent(cleanQuery)}&include_adult=false&language=en-US`, fetchOptions);
          if (searchRes.ok) {
            const sData = await searchRes.json();
            const first = sData.results?.[0];
            if (first && (first.media_type === 'tv' || first.media_type === 'movie')) {
              item.tmdb_id = first.id;
              item.tmdb_type = first.media_type;
              info = getLogoCacheKey(item);
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  if (!info) return null;
  const { cacheKey, type, id } = info;

  const inMemory = memoryLogoCache.get(cacheKey);
  if (typeof inMemory === 'string' && inMemory.length > 0) {
    preloadImageUrl(inMemory);
    return inMemory;
  }

  if (inFlightLogos.has(cacheKey)) {
    return inFlightLogos.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    let finalUrl: string | null = null;
    let source = 'none';

    // 1. Fetch TMDB images without language filter so all logos (en, null, ja) are retrieved
    try {
      const res = await fetch(`${BASE_URL}/${type}/${id}/images`, fetchOptions);
      if (res.ok) {
        const data = await res.json();
        const tmdbLogo = extractBestLogoPath(data.logos || []);
        if (tmdbLogo) {
          finalUrl = `${IMAGE_BASE_URL_W500}${tmdbLogo}`;
          source = 'TMDB';
        }
      }
    } catch (error) {
      // ignore
    }

    // 2. If no logo found and it was a TV show, check Movie endpoint (and vice-versa)
    if (!finalUrl) {
      const altType = type === 'tv' ? 'movie' : 'tv';
      try {
        const altRes = await fetch(`${BASE_URL}/${altType}/${id}/images`, fetchOptions);
        if (altRes.ok) {
          const altData = await altRes.json();
          const altLogo = extractBestLogoPath(altData.logos || []);
          if (altLogo) {
            finalUrl = `${IMAGE_BASE_URL_W500}${altLogo}`;
            source = 'TMDB';
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Fallback to Fanart.tv if available
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

    if (finalUrl) {
      memoryLogoCache.set(cacheKey, finalUrl);
      preloadImageUrl(finalUrl);

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

export const preloadLogosForItems = async (items: any[]): Promise<void> => {
  if (!Array.isArray(items)) return;
  await Promise.all(
    items.map(async (item) => {
      if (!item) return;
      try {
        const logoUrl = await resolveLogo(item);
        if (logoUrl) preloadImageUrl(logoUrl);
      } catch (e) {
        // ignore
      }
    })
  );
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
  if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/trending/all/day?language=en-US`, fetchOptions);
      if (!res.ok) throw new Error('Not OK');
      const data = await res.json();
      if (data && data.results) {
        data.results = filterOutAnime(data.results);
        indexSeedItems(data.results);
      }
      responseCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.warn("fetchTrending failed:", error);
      return { results: [] };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  inFlightRequests.set(cacheKey, p);
  return p;
};

export const fetchTop10 = async () => {
  const cacheKey = 'tv_popular_1';
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/tv/popular?language=en-US&page=1`, fetchOptions);
      if (!res.ok) throw new Error('Not OK');
      const data = await res.json();
      if (data && data.results) {
        data.results = filterOutAnime(data.results);
        data.results.forEach((r: any) => { r.media_type = 'tv'; });
        indexSeedItems(data.results, 'tv');
      }
      responseCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.warn("fetchTop10 failed:", error);
      return { results: [] };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  inFlightRequests.set(cacheKey, p);
  return p;
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
      indexSeedItems(data.results, 'movie');
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
  if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      // For TV series, also fetch season/1 and videos in the exact same single request!
      const append = type === 'tv'
        ? 'images,credits,content_ratings,release_dates,videos,season/1'
        : 'images,credits,content_ratings,release_dates,videos';
      const res = await fetch(`${BASE_URL}/${type}/${id}?append_to_response=${append}`, fetchOptions);
      if (!res.ok) throw new Error('Not OK');
      const data = await res.json();
      if (data) {
        data.media_type = type;
        const bestLogo = extractBestLogoPath(data.images?.logos || []);
        primeLogoCache(type, id, bestLogo);
        data.logo_path = bestLogo ? `${IMAGE_BASE_URL_W500}${bestLogo}` : null;

        // Pre-populate trailer cache if videos were returned
        if (data.videos?.results) {
          const videos = data.videos.results;
          const officialTrailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official);
          const anyTrailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
          const anyVideo = videos.find((v: any) => v.site === 'YouTube');
          const trailerKey = officialTrailer?.key || anyTrailer?.key || anyVideo?.key || null;
          trailerCache.set(`${type}_${id}`, trailerKey);
        }

        // Pre-populate season 1 cache if returned
        if (type === 'tv' && data['season/1']) {
          responseCache.set(`tv_season_${id}_1`, data['season/1']);
        }

        setSeedItem(type, id, data);
        responseCache.set(cacheKey, data);
      }
      return data;
    } catch (error) {
      if (retries > 0) {
        inFlightRequests.delete(cacheKey);
        await new Promise(resolve => setTimeout(resolve, 200));
        return fetchDetails(id, type, retries - 1);
      }
      console.warn("fetchDetails failed:", error);
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, p);
  return p;
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
  if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/discover/movie?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
      if (!res.ok) throw new Error('Not OK');
      const data = await res.json();
      if (data && data.results) {
        data.results = filterOutAnime(data.results);
        data.results.forEach((r: any) => { r.media_type = 'movie'; });
        indexSeedItems(data.results, 'movie');
      }
      responseCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.warn(`fetchByGenre failed for genre ${genreId}:`, error);
      return { results: [] };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  inFlightRequests.set(cacheKey, p);
  return p;
};

export const fetchTVByGenre = async (genreId: number) => {
  const cacheKey = `tv_genre_${genreId}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
      if (!res.ok) throw new Error('Not OK');
      const data = await res.json();
      if (data && data.results) {
        data.results = filterOutAnime(data.results);
        data.results.forEach((r: any) => { r.media_type = 'tv'; });
        indexSeedItems(data.results, 'tv');
      }
      responseCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.warn(`fetchTVByGenre failed for genre ${genreId}:`, error);
      return { results: [] };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  inFlightRequests.set(cacheKey, p);
  return p;
};

export const fetchTVSeason = async (tvId: number, seasonNumber: number, retries = 2): Promise<any> => {
  const cacheKey = `tv_season_${tvId}_${seasonNumber}`;
  if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);
  if (inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey)!;

  const p = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?language=en-US`, fetchOptions);
      if (!res.ok) throw new Error('Not OK');
      const data = await res.json();
      responseCache.set(cacheKey, data);
      return data;
    } catch (error) {
      if (retries > 0) {
        inFlightRequests.delete(cacheKey);
        await new Promise(resolve => setTimeout(resolve, 200));
        return fetchTVSeason(tvId, seasonNumber, retries - 1);
      }
      console.warn(`fetchTVSeason failed for tv ${tvId} season ${seasonNumber}:`, error);
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  inFlightRequests.set(cacheKey, p);
  return p;
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
      data.results.forEach((r: any) => { r.media_type = 'movie'; });
      indexSeedItems(data.results, 'movie');
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
      data.results.forEach((r: any) => { r.media_type = 'tv'; });
      indexSeedItems(data.results, 'tv');
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
      indexSeedItems(data.results, 'movie');
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
      indexSeedItems(data.results, 'tv');
    }
    return data;
  } catch (error) {
    console.warn("searchTV failed:", error);
    return { results: [] };
  }
};
