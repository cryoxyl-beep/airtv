import { getTmdbId } from './fribb';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const fetchAniList = async (query: string, variables: any = {}) => {
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
  const response = await fetch(ANILIST_API_URL, options);
  if (!response.ok) {
    throw new Error('AniList API error');
  }
  return response.json();
};

const normalizeAniListToTmdb = async (media: any): Promise<any> => {
  if (!media) return null;
  
  const tmdbMapping = await getTmdbId(media.id);
  const tmdbId = tmdbMapping?.id;
  const tmdbType = tmdbMapping?.type || 'tv';
  const tmdbSeason = tmdbMapping?.season;
  
  if (!tmdbId) {
    console.log('[Fribb] NO TMDB MATCH for AniList ID:', media.id, media.title?.english || media.title?.romaji);
  }

  let poster_path = media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = media.bannerImage || media.coverImage?.extraLarge;
  
  const title = media.title?.english || media.title?.romaji || media.title?.native;

  return {
    id: media.id,
    tmdb_id: tmdbId, // keep track of the tmdb ID
    tmdb_season: tmdbSeason, // keep track of mapped tmdb season
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

export const fetchTrendingAnime = async (perPage = 10) => {
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
    const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchTrendingAnime failed:', e);
    return { results: [] };
  }
};

export const fetchNewlyAddedAnime = async (perPage = 10) => {
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
    const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error('fetchNewlyAddedAnime failed:', e);
    return { results: [] };
  }
};

export const fetchAnimeDetails = async (id: number) => {
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

export const fetchAnimeByGenre = async (genre: string, perPage = 20) => {
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
    const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`fetchAnimeByGenre failed for ${genre}:`, e);
    return { results: [] };
  }
};

export const searchAnime = async (search: string, perPage = 20) => {
  const query = `
    query ($search: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (type: ANIME, search: $search, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult: false) {
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
    const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));
    return { results: results.filter(Boolean) };
  } catch (e) {
    console.error(`searchAnime failed for ${search}:`, e);
    return { results: [] };
  }
};
