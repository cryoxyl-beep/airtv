import { resolveAnimeMapping, preloadFribbMapping } from './fribb';
import { buildAnimeGroup, nodeCache, groupCache } from './anilistGroups';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchAniList = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
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
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : (i + 1) * 1000;
          await sleep(delay);
          continue;
        }
        throw new Error('AniList API error: ' + response.status);
      }
      return await response.json();
    } catch (e: any) {
      if (i === retries - 1) throw e;
      await sleep((i + 1) * 1000);
    }
  }
};

const normalizeAniListToTmdb = async (media: any): Promise<any> => {
  if (!media) return null;
  
    buildAnimeGroup(media);
  const mapping = await resolveAnimeMapping(media.id);
  const isMovieFormat = media.format === 'MOVIE' || mapping.type === 'MOVIE';
  const tmdbId = isMovieFormat && mapping.tmdbMovieId ? mapping.tmdbMovieId : (mapping.tmdbTvId || mapping.tmdbMovieId);
  const tmdbType = (isMovieFormat && mapping.tmdbMovieId) ? 'movie' : (mapping.tmdbTvId ? 'tv' : 'movie');
  const tmdbSeason = mapping.seasonMapping;
  
  if (!mapping.mappingFound) {
    console.log('[Fribb] NO TMDB MATCH for AniList ID:', media.id, media.title?.english || media.title?.romaji);
  }

  let poster_path = media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = media.bannerImage || media.coverImage?.extraLarge;
  
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

export const fetchTrendingAnime = async (perPage = 10) => {
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
        relations {
          edges {
            relationType
            node {
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
              format
              type
              relations {
                edges {
                  relationType
                  node {
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
                    format
                    type
                  }
                }
              }
            }
          }
        }
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { perPage });
    const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));
    return { results: await deduplicateAnimeList(results.filter(Boolean)) };
  } catch (e) {
    console.error('fetchTrendingAnime failed:', e);
    return { results: [] };
  }
};

export const fetchNewlyAddedAnime = async (perPage = 10) => {
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
        relations {
          edges {
            relationType
            node {
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
              format
              type
              relations {
                edges {
                  relationType
                  node {
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
                    format
                    type
                  }
                }
              }
            }
          }
        }
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { perPage });
    const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));
    return { results: await deduplicateAnimeList(results.filter(Boolean)) };
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
              format
              type
              relations {
                edges {
                  relationType
                  node {
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
                    format
                    type
                  }
                }
              }
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

export const fetchAnimeByGenre = async (genre: string, perPage = 20) => {
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
        relations {
          edges {
            relationType
            node {
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
              format
              type
              relations {
                edges {
                  relationType
                  node {
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
                    format
                    type
                  }
                }
              }
            }
          }
        }
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { genre, perPage });
    const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));
    return { results: await deduplicateAnimeList(results.filter(Boolean)) };
  } catch (e) {
    console.error(`fetchAnimeByGenre failed for ${genre}:`, e);
    return { results: [] };
  }
};

export const searchAnime = async (search: string, perPage = 20) => {
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
        relations {
          edges {
            relationType
            node {
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
              format
              type
              relations {
                edges {
                  relationType
                  node {
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
                    format
                    type
                  }
                }
              }
            }
          }
        }
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

export const deduplicateAnimeList = async (results: any[]) => {
  const seenFranchise = new Set<number>();
  const finalResults = [];
  
  for (const item of results) {
    if (!item || !item.anilist_raw) continue;
    const group = buildAnimeGroup(item.anilist_raw);
    const groupId = group ? group.groupId : item.id;
    
    if (!seenFranchise.has(groupId)) {
      seenFranchise.add(groupId);
      
      if (group && groupId !== item.id) {
        // Swap with canonical parent
        const canonicalRaw = nodeCache.get(groupId);
        if (canonicalRaw) {
          // ensure relations are copied over so we don't lose the group if someone clicks on the canonical item
          if (!canonicalRaw.relations) canonicalRaw.relations = item.anilist_raw.relations;
          const canonicalNorm = await normalizeAniListToTmdb(canonicalRaw);
          if (canonicalNorm) finalResults.push(canonicalNorm);
        } else {
          finalResults.push(item);
        }
      } else {
        finalResults.push(item);
      }
    }
  }
  return finalResults;
};
