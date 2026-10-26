import { resolveAnimeMapping, preloadFribbMapping } from './fribb';
import { extractBestLogoPath, primeLogoCache, IMAGE_BASE_URL_W500, setSeedItem, getSeedItem } from './tmdb';

const ANILIST_API_URL = 'https://graphql.anilist.co';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYmM3ZjM4ZTEwNzBmMWI4NzM2MDc4OTM4MDA1OThkOSIsIm5iZiI6MTcxNzIxNDAzNi4wMzIsInN1YiI6IjY2NWE5YjU0M2MzMmNiMWFiZmFmMGFmOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.BEKlgnL8r52GcU2Fb8QXcp3W9-giqabR8AtbBlGDmU0';

preloadFribbMapping();

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  description
  coverImage { extraLarge large }
  bannerImage
  averageScore
  startDate { year month day }
  status
  episodes
  genres
  trailer { id site }
  relations {
    edges {
      relationType
      node {
        id
        type
        format
        title { romaji english }
      }
    }
  }
  streamingEpisodes {
    title
    thumbnail
    url
    site
  }
`;

interface TmdbAnimeMediaCache {
  poster_path: string | null;
  backdrop_path: string | null;
  logo_path: string | null;
}

const tmdbMediaMemoryCache = new Map<string, TmdbAnimeMediaCache>();
const inFlightTmdbMedia = new Map<string, Promise<TmdbAnimeMediaCache | null>>();
const anilistResponseCache = new Map<string, any>();
const inFlightAniList = new Map<string, Promise<any>>();

const fetchTmdbImages = async (tmdbId: number | string, tmdbType: string): Promise<TmdbAnimeMediaCache | null> => {
  const key = `tmdb_anime_v2_${tmdbType}_${tmdbId}`;

  if (tmdbMediaMemoryCache.has(key)) {
    const cached = tmdbMediaMemoryCache.get(key)!;
    primeLogoCache(tmdbType, tmdbId, cached.logo_path);
    return cached;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: TmdbAnimeMediaCache = JSON.parse(raw);
        if (parsed) {
          tmdbMediaMemoryCache.set(key, parsed);
          primeLogoCache(tmdbType, tmdbId, parsed.logo_path);
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (inFlightTmdbMedia.has(key)) {
    return inFlightTmdbMedia.get(key)!;
  }

  const promise = (async () => {
    try {
      const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?append_to_response=images`;
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${TMDB_TOKEN}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const bestLogo = extractBestLogoPath(data.images?.logos || []);
        const result: TmdbAnimeMediaCache = {
          poster_path: data.poster_path || null,
          backdrop_path: data.backdrop_path || null,
          logo_path: bestLogo ? `${IMAGE_BASE_URL_W500}${bestLogo}` : null
        };

        tmdbMediaMemoryCache.set(key, result);
        primeLogoCache(tmdbType, tmdbId, result.logo_path);

        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem(key, JSON.stringify(result));
          } catch (e) {
            // ignore quota errors
          }
        }
        return result;
      }
    } catch (e) {
      // ignore
    }
    return null;
  })();

  inFlightTmdbMedia.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlightTmdbMedia.delete(key);
  }
};

const fetchAniList = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
  const cacheKey = `anilist_v2_${JSON.stringify({ q: query.trim(), v: variables })}`;

  if (anilistResponseCache.has(cacheKey)) {
    return anilistResponseCache.get(cacheKey);
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        anilistResponseCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (e) {
      // ignore
    }
  }

  if (inFlightAniList.has(cacheKey)) {
    return inFlightAniList.get(cacheKey)!;
  }

  const requestPromise = (async () => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    };

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(ANILIST_API_URL, options);
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : (i + 1) * 800;
            await sleep(delay);
            continue;
          }
          throw new Error('AniList API error: ' + response.status);
        }
        const json = await response.json();
        anilistResponseCache.set(cacheKey, json);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(json));
          } catch (e) {
            // ignore
          }
        }
        return json;
      } catch (e: any) {
        if (i === retries - 1) throw e;
        await sleep((i + 1) * 400);
      }
    }
  })();

  inFlightAniList.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightAniList.delete(cacheKey);
  }
};

const normalizeAniListToTmdb = async (media: any, skipTmdbImages: boolean = false): Promise<any> => {
  if (!media) return null;

  // Check if we already fully normalized this anime with TMDB images
  if (!skipTmdbImages) {
    const existing = getSeedItem('anime', media.id);
    if (existing && existing.anilist_raw?.relations) {
      return existing;
    }
  }
  
  const mapping = await resolveAnimeMapping(media.id);
  const isMovieFormat = media.format === 'MOVIE' || mapping.type === 'MOVIE';
  const tmdbId = isMovieFormat && mapping.tmdbMovieId ? mapping.tmdbMovieId : (mapping.tmdbTvId || mapping.tmdbMovieId);
  const tmdbType = (isMovieFormat && mapping.tmdbMovieId) ? 'movie' : (mapping.tmdbTvId ? 'tv' : 'movie');
  const tmdbSeason = mapping.seasonMappingTVDB;

  let poster_path = media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = media.bannerImage || media.coverImage?.extraLarge;
  let logo_path: string | null = null;
  
  if (!skipTmdbImages && tmdbId && tmdbType) {
    const tmdbImages = await fetchTmdbImages(tmdbId, tmdbType);
    if (tmdbImages) {
      if (tmdbImages.poster_path) poster_path = tmdbImages.poster_path;
      if (tmdbImages.backdrop_path) backdrop_path = tmdbImages.backdrop_path;
      if (tmdbImages.logo_path) logo_path = tmdbImages.logo_path;
    }
  }
  
  const title = media.title?.english || media.title?.romaji || media.title?.native;

  const normalized = {
    id: media.id,
    tmdb_id: tmdbId,
    tmdb_season: tmdbSeason,
    tmdb_type: tmdbType,
    fribb_mapping: mapping,
    source: 'anilist',
    media_type: 'anime',
    anime_format: tmdbType,
    title: title,
    original_title: media.title?.native,
    name: title,
    original_name: media.title?.native,
    overview: media.description?.replace(/<[^>]*>?/gm, ''),
    poster_path: poster_path,
    backdrop_path: backdrop_path,
    logo_path: logo_path,
    vote_average: media.averageScore ? media.averageScore / 10 : 0,
    first_air_date: media.startDate?.year ? `${media.startDate.year}-${String(media.startDate.month).padStart(2, '0')}-${String(media.startDate.day).padStart(2, '0')}` : undefined,
    genre_ids: [], 
    genres: media.genres?.map((g: string) => ({ id: g, name: g })) || [],
    status: media.status === 'RELEASING' ? 'Returning Series' : (media.status === 'FINISHED' ? 'Ended' : media.status),
    number_of_episodes: media.episodes,
    trailer: media.trailer?.site === 'youtube' ? media.trailer.id : null,
    anilist_raw: media
  };

  if (!skipTmdbImages) {
    setSeedItem('anime', media.id, normalized);
  }
  return normalized;
};

export const fetchTrendingAnime = async (perPage = 10, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, sort: TRENDING_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { perPage });
    const mediaItems = data.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchTrendingAnime failed:', e);
    return { results: [] };
  }
};

export const fetchNewlyAddedAnime = async (perPage = 10, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, sort: START_DATE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { perPage });
    const mediaItems = data.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchNewlyAddedAnime failed:', e);
    return { results: [] };
  }
};

export const fetchAnimeDetails = async (id: number) => {
  // Instant return if already cached in memory with relations
  const cached = getSeedItem('anime', id);
  if (cached && cached.anilist_raw?.relations) {
    return cached;
  }

  await preloadFribbMapping();
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { id });
    return await normalizeAniListToTmdb(data.data?.Media);
  } catch (e) {
    console.error(`fetchAnimeDetails failed for ${id}:`, e);
    return cached || null;
  }
};

export const fetchAnimeByGenre = async (genre: string, perPage = 20, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($genre: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, genre: $genre, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { genre, perPage });
    const mediaItems = data.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`fetchAnimeByGenre failed for ${genre}:`, e);
    return { results: [] };
  }
};

export const fetchAnimeByTag = async (tag: string, perPage = 20, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($tag: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, tag: $tag, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { tag, perPage });
    const mediaItems = data.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`fetchAnimeByTag failed for ${tag}:`, e);
    return { results: [] };
  }
};

export const fetchTopRatedAnime = async (perPage = 20, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, sort: SCORE_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { perPage });
    const mediaItems = data.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchTopRatedAnime failed:', e);
    return { results: [] };
  }
};

export const searchAnime = async (search: string, perPage = 20, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($search: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { search, perPage });
    const mediaItems = data.data?.Page?.media || [];
    const results = await Promise.all(
      mediaItems.map((item: any) => normalizeAniListToTmdb(item, skipTmdbImages))
    );
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`searchAnime failed for ${search}:`, e);
    return { results: [] };
  }
};
