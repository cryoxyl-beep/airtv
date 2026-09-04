import { resolveAnimeMapping, preloadFribbMapping } from './fribb';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYmM3ZjM4ZTEwNzBmMWI4NzM2MDc4OTM4MDA1OThkOSIsIm5iZiI6MTcxNzIxNDAzNi4wMzIsInN1YiI6IjY2NWE5YjU0M2MzMmNiMWFiZmFmMGFmOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.BEKlgnL8r52GcU2Fb8QXcp3W9-giqabR8AtbBlGDmU0';

const fetchTmdbImages = async (tmdbId, tmdbType) => {
  try {
    const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}`;
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${TMDB_TOKEN}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path
      };
    }
  } catch (e) {
    console.error('fetchTmdbImages failed', e);
  }
  return null;
};


let anilistQueue: Promise<void> = Promise.resolve();

const fetchAniListInternal = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  };
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(ANILIST_API_URL, options);
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : (i + 1) * 1500;
          await sleep(delay);
          continue;
        }
        throw new Error('AniList API error: ' + response.status);
      }
      return await response.json();
    } catch (e: any) {
      // If it's a network error (often a CORS error hiding a 429), back off heavily
      if (i === retries - 1) throw e;
      await sleep((i + 1) * 1500);
    }
  }
};

const fetchAniList = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
  return new Promise((resolve, reject) => {
    anilistQueue = anilistQueue.then(async () => {
      try {
        const res = await fetchAniListInternal(query, variables, retries);
        resolve(res);
      } catch (e) {
        reject(e);
      }
      // Delay to respect AniList 90 req/min limit (~666ms per req)
      await sleep(50); 
    }).catch(async () => {
      await sleep(50);
    });
  });
};

const normalizeAniListToTmdb = async (media: any, skipTmdbImages: boolean = false): Promise<any> => {
  if (!media) return null;
  
  const mapping = await resolveAnimeMapping(media.id);
  const isMovieFormat = media.format === 'MOVIE' || mapping.type === 'MOVIE';
  const tmdbId = isMovieFormat && mapping.tmdbMovieId ? mapping.tmdbMovieId : (mapping.tmdbTvId || mapping.tmdbMovieId);
  const tmdbType = (isMovieFormat && mapping.tmdbMovieId) ? 'movie' : (mapping.tmdbTvId ? 'tv' : 'movie');
  const tmdbSeason = mapping.seasonMappingTVDB;
  
  if (!mapping.mappingFound) {
    console.log('[Fribb] NO TMDB MATCH for AniList ID:', media.id, media.title?.english || media.title?.romaji);
  }

  let poster_path = media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = media.bannerImage || media.coverImage?.extraLarge;
  
  // Override with TMDB images if mapped
  if (!skipTmdbImages && tmdbId && tmdbType) {
    const tmdbImages = await fetchTmdbImages(tmdbId, tmdbType);
    if (tmdbImages) {
      if (tmdbImages.poster_path) poster_path = tmdbImages.poster_path;
      if (tmdbImages.backdrop_path) backdrop_path = tmdbImages.backdrop_path;
    }
  }
  
  const title = media.title?.english || media.title?.romaji || media.title?.native;

  return {
    id: media.id,
    tmdb_id: tmdbId, // keep track of the tmdb ID
    tmdb_season: tmdbSeason, // keep track of mapped tmdb season
    tmdb_type: tmdbType,
    fribb_mapping: mapping, // full mapping details
    source: 'anilist',
    media_type: 'anime', // explicitly mark as anime
    anime_format: tmdbType, // but keep the format if we need to know if it's a movie or tv
    title: title,
    original_title: media.title?.native,
    name: title,
    original_name: media.title?.native,
    overview: media.description?.replace(/<[^>]*>?/gm, ''), // strip html tags
    poster_path: poster_path,
    backdrop_path: backdrop_path,
    vote_average: media.averageScore ? media.averageScore / 10 : 0, // convert 0-100 to 0-10
    first_air_date: media.startDate?.year ? `${media.startDate.year}-${String(media.startDate.month).padStart(2, '0')}-${String(media.startDate.day).padStart(2, '0')}` : undefined,
    genre_ids: [], 
    genres: media.genres?.map((g: string) => ({ id: g, name: g })) || [],
    status: media.status === 'RELEASING' ? 'Returning Series' : (media.status === 'FINISHED' ? 'Ended' : media.status),
    number_of_episodes: media.episodes,
    trailer: media.trailer?.site === 'youtube' ? media.trailer.id : null,
    anilist_raw: media
  };
};

export const fetchTrendingAnime = async (perPage = 10, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, sort: TRENDING_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
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
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { perPage });
        const mediaItems = data.data?.Page?.media || [];
    const results = [];
    for (const item of mediaItems) {
      results.push(await normalizeAniListToTmdb(item, skipTmdbImages));
      // Add a tiny delay to prevent overwhelming TMDB connections if fetching images
      if (!skipTmdbImages) {
        await sleep(25);
      }
    }
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
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { perPage });
        const mediaItems = data.data?.Page?.media || [];
    const results = [];
    for (const item of mediaItems) {
      results.push(await normalizeAniListToTmdb(item, skipTmdbImages));
      // Add a tiny delay to prevent overwhelming TMDB connections if fetching images
      if (!skipTmdbImages) {
        await sleep(25);
      }
    }
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchNewlyAddedAnime failed:', e);
    return { results: [] };
  }
};

export const fetchAnimeDetails = async (id: number) => {
  await preloadFribbMapping();
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
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
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { id });
    return await normalizeAniListToTmdb(data.data?.Media);
  } catch (e) {
    console.error(`fetchAnimeDetails failed for ${id}:`, e);
    return null;
  }
};

export const fetchAnimeByGenre = async (genre: string, perPage = 20, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($genre: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, genre: $genre, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
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
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { genre, perPage });
        const mediaItems = data.data?.Page?.media || [];
    const results = [];
    for (const item of mediaItems) {
      results.push(await normalizeAniListToTmdb(item, skipTmdbImages));
      // Add a tiny delay to prevent overwhelming TMDB connections if fetching images
      if (!skipTmdbImages) {
        await sleep(25);
      }
    }
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`fetchAnimeByGenre failed for ${genre}:`, e);
    return { results: [] };
  }
};

export const searchAnime = async (search: string, perPage = 20, skipTmdbImages = false) => {
  await preloadFribbMapping();
  const query = `
    query ($search: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
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
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { search, perPage });
        const mediaItems = data.data?.Page?.media || [];
    const results = [];
    for (const item of mediaItems) {
      results.push(await normalizeAniListToTmdb(item, skipTmdbImages));
      // Add a tiny delay to prevent overwhelming TMDB connections if fetching images
      if (!skipTmdbImages) {
        await sleep(25);
      }
    }
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`searchAnime failed for ${search}:`, e);
    return { results: [] };
  }
};
