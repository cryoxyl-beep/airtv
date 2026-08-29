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

export const buildAnimeEpisodeList = async (
  anilistId: number, 
  totalEpisodes: number
): Promise<ResolvedAnimeEpisode[]> => {
  await preloadFribbMapping();
  const mapping = await resolveAnimeMapping(anilistId);
  
  let jikanEpisodes: any[] = [];
  if (mapping.malId) {
    jikanEpisodes = await fetchJikanEpisodesList(mapping.malId);
  }
  
  let tvdbEpisodes: any[] = [];
  if (mapping.tvdbId) {
    tvdbEpisodes = await fetchTVDBEpisodesForSeries(mapping.tvdbId);
  }
  
  // Build list
  const count = totalEpisodes > 0 ? totalEpisodes : Math.max(jikanEpisodes.length, 12);
  const result: ResolvedAnimeEpisode[] = [];
  
  for (let i = 1; i <= count; i++) {
    const epNum = i; // Absolute relative to this AniList entry
    
    // 1. Find Jikan match
    const jMatch = jikanEpisodes.find(e => e.mal_id === epNum);
    
    // 2. Find TVDB match
    let tMatch = null;
    if (mapping.seasonMappingTVDB) {
      tMatch = tvdbEpisodes.find(e => e.seasonNumber === mapping.seasonMappingTVDB && e.number === epNum);
    } else {
      tMatch = tvdbEpisodes.find(e => e.absoluteNumber === epNum) || 
               tvdbEpisodes.find(e => e.seasonNumber === 1 && e.number === epNum);
    }
    
    let stillPath = null;
    if (tMatch && tMatch.image) {
      stillPath = tMatch.image.startsWith('http') ? tMatch.image : `https://artworks.thetvdb.com${tMatch.image}`;
    }
    
    result.push({
      episode_number: epNum,
      name: jMatch?.title || `Episode ${epNum}`,
      overview: jMatch?.synopsis || "No description available.",
      still_path: stillPath,
      airDate: jMatch?.aired
    });
  }
  
  return result;
};
