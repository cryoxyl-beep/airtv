const API_READ_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYmM3ZjM4ZTEwNzBmMWI4NzM2MDc4OTM4MDA1OThkOSIsIm5iZiI6MTcxNzIxNDAzNi4wMzIsInN1YiI6IjY2NWE5YjU0M2MzMmNiMWFiZmFmMGFmOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.BEKlgnL8r52GcU2Fb8QXcp3W9-giqabR8AtbBlGDmU0';

const BASE_URL = 'https://api.themoviedb.org/3';
export const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';
export const IMAGE_BASE_URL_W500 = 'https://image.tmdb.org/t/p/w500';
export const IMAGE_BASE_URL_W300 = 'https://image.tmdb.org/t/p/w300';

const fetchOptions = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${API_READ_TOKEN}`
  }
};

export const fetchTrending = async () => {
  const res = await fetch(`${BASE_URL}/trending/all/day?language=en-US`, fetchOptions);
  return res.json();
};

export const fetchTop10 = async () => {
  // Using popular as a proxy for Top 10
  const res = await fetch(`${BASE_URL}/tv/popular?language=en-US&page=1`, fetchOptions);
  return res.json();
};

export const fetchAnime = async () => {
  // Animation genre (16) and origin country Japan (JP)
  const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=16&origin_country=JP`, fetchOptions);
  return res.json();
};

export const fetchAllTimeFavorites = async () => {
  const res = await fetch(`${BASE_URL}/movie/top_rated?language=en-US&page=1`, fetchOptions);
  return res.json();
};

export const fetchDetails = async (id: number, type: 'movie' | 'tv' = 'tv') => {
  const res = await fetch(`${BASE_URL}/${type}/${id}?append_to_response=images,credits,content_ratings,release_dates&include_image_language=en,null`, fetchOptions);
  return res.json();
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

const logoCache = new Map<string, string | null>();

export const resolveLogo = async (item: any): Promise<string | null> => {
  if (!item) return null;
  
  const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const cacheKey = `${type}_${item.id}`;
  
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey)!;
  }
  
  // 1. TMDB Logo Check
  let tmdbLogo: string | null = null;
  
  // First check if logos are already present in item metadata (e.g. Hero section item)
  const logos = item.images?.logos || [];
  if (logos.length > 0) {
    logos.sort((a: any, b: any) => b.vote_average - a.vote_average);
    const enLogo = logos.find((l: any) => l.iso_639_1 === 'en');
    tmdbLogo = enLogo?.file_path || logos[0]?.file_path;
  }
  
  // If not in item, fetch it from TMDB images endpoint
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
    const fullUrl = `${IMAGE_BASE_URL}${tmdbLogo}`; // We'll return full URLs for both TMDB and Fanart
    logoCache.set(cacheKey, fullUrl);
    return fullUrl;
  }
  
  // 2. Fanart.tv Fallback
  const FANART_API_KEY = import.meta.env.VITE_FANART_API_KEY || '[PASTE_FANART_API_KEY_HERE]';
  let fanartLogoUrl: string | null = null;
  
  if (type === 'movie') {
    try {
      const res = await fetch(`https://webservice.fanart.tv/v3.2/movies/${item.id}?api_key=${FANART_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        const hdlogos = data.hdmovielogo || [];
        if (hdlogos.length > 0) {
          // Prioritize english, then fallback
          const enLogo = hdlogos.find((l: any) => l.lang === 'en');
          fanartLogoUrl = enLogo?.url || hdlogos[0]?.url;
        }
      }
    } catch (e) {
      // ignore
    }
  } else if (type === 'tv') {
    // Check if existing metadata has a tvdb_id
    const tvdbId = item.external_ids?.tvdb_id || item.tvdb_id;
    if (tvdbId) {
      try {
        const res = await fetch(`https://webservice.fanart.tv/v3.2/tv/${tvdbId}?api_key=${FANART_API_KEY}`);
        if (res.ok) {
          const data = await res.json();
          const hdtvlogos = data.hdtvlogo || [];
          if (hdtvlogos.length > 0) {
            const enLogo = hdtvlogos.find((l: any) => l.lang === 'en');
            fanartLogoUrl = enLogo?.url || hdtvlogos[0]?.url;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }
  
  if (fanartLogoUrl) {
    logoCache.set(cacheKey, fanartLogoUrl);
    return fanartLogoUrl;
  }
  
  // 3. Fallback: No logo
  logoCache.set(cacheKey, null);
  return null;
};

export const fetchByGenre = async (genreId: number) => {
  const res = await fetch(`${BASE_URL}/discover/movie?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
  return res.json();
};

export const fetchTVByGenre = async (genreId: number) => {
  const res = await fetch(`${BASE_URL}/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&with_genres=${genreId}`, fetchOptions);
  return res.json();
};

