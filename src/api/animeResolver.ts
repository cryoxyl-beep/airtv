import { resolveAnimeMapping, preloadFribbMapping } from './fribb';
import { fetchTVDBEpisodesForSeries } from './tvdb';
import { fetchJikanEpisodesList } from './jikan';

export interface ResolvedAnimeEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  airDate?: string;
}

const resolvedEpisodesCache = new Map<number, ResolvedAnimeEpisode[]>();

export const buildAnimeEpisodeList = async (
  anilistId: number, 
  totalEpisodes: number,
  streamingEpisodes?: any[],
  fallbackBackdrop?: string | null
): Promise<ResolvedAnimeEpisode[]> => {
  if (resolvedEpisodesCache.has(anilistId) && (!totalEpisodes || resolvedEpisodesCache.get(anilistId)!.length >= totalEpisodes)) {
    return resolvedEpisodesCache.get(anilistId)!;
  }

  await preloadFribbMapping();
  const mapping = await resolveAnimeMapping(anilistId);
  
  // Run Jikan and TVDB episode fetches in PARALLEL instead of sequentially
  const [jikanEpisodes, tvdbEpisodes] = await Promise.all([
    mapping.malId ? fetchJikanEpisodesList(mapping.malId) : Promise.resolve([]),
    mapping.tvdbId ? fetchTVDBEpisodesForSeries(mapping.tvdbId) : Promise.resolve([])
  ]);
  
  const count = totalEpisodes > 0 ? totalEpisodes : Math.max(jikanEpisodes.length, streamingEpisodes?.length || 0, 12);
  const result: ResolvedAnimeEpisode[] = [];
  
  for (let i = 1; i <= count; i++) {
    const epNum = i;
    
    // 1. Find Jikan match
    const jMatch = jikanEpisodes.find((e: any) => e.mal_id === epNum);
    
    // 2. Find TVDB match
    let tMatch = null;
    if (mapping.seasonMappingTVDB) {
      tMatch = tvdbEpisodes.find((e: any) => e.seasonNumber === mapping.seasonMappingTVDB && e.number === epNum);
    } else {
      tMatch = tvdbEpisodes.find((e: any) => e.absoluteNumber === epNum) || 
               tvdbEpisodes.find((e: any) => e.seasonNumber === 1 && e.number === epNum);
    }

    // 3. Fallback to AniList streamingEpisodes if available
    const streamEp = streamingEpisodes && streamingEpisodes[epNum - 1];
    
    let stillPath: string | null = null;
    if (tMatch && tMatch.image) {
      stillPath = tMatch.image.startsWith('http') ? tMatch.image : `https://artworks.thetvdb.com${tMatch.image}`;
    } else if (streamEp?.thumbnail) {
      stillPath = streamEp.thumbnail;
    } else if (fallbackBackdrop) {
      stillPath = fallbackBackdrop;
    }
    
    result.push({
      episode_number: epNum,
      name: jMatch?.title || tMatch?.name || (streamEp?.title ? streamEp.title.replace(/^Episode\s+\d+\s*-\s*/i, '') : `Episode ${epNum}`),
      overview: jMatch?.synopsis || tMatch?.overview || "No description available.",
      still_path: stillPath,
      airDate: jMatch?.aired || tMatch?.aired
    });
  }
  
  resolvedEpisodesCache.set(anilistId, result);
  return result;
};
