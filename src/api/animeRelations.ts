export interface AnimeSeason {
  anilistId: number;
  title: string;
  relationType?: string;
  isCurrent: boolean;
  
  // For compatibility with TMDB season selector
  id: number;
  name: string;
  season_number: number;
}

export const extractAnimeSeasons = (rawMedia: any): AnimeSeason[] => {
  if (!rawMedia || !rawMedia.relations || !rawMedia.relations.edges) {
    const title = rawMedia?.title?.english || rawMedia?.title?.romaji || "Season 1";
    return [{
      anilistId: rawMedia?.id,
      title: title,
      isCurrent: true,
      id: rawMedia?.id,
      name: title,
      season_number: rawMedia?.id
    }];
  }

  const seasons: AnimeSeason[] = [];
  
  const currentTitle = rawMedia.title?.english || rawMedia.title?.romaji || "Current Season";
  seasons.push({
    anilistId: rawMedia.id,
    title: currentTitle,
    isCurrent: true,
    id: rawMedia.id,
    name: currentTitle,
    season_number: rawMedia.id
  });
  
  for (const edge of rawMedia.relations.edges) {
    if ((edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL' || edge.relationType === 'ALTERNATIVE' || edge.relationType === 'PARENT') && 
        edge.node.type === 'ANIME' && 
        (edge.node.format === 'TV' || edge.node.format === 'TV_SHORT' || edge.node.format === 'ONA' || edge.node.format === 'MOVIE')) {
      const edgeTitle = edge.node.title?.english || edge.node.title?.romaji || `Related (${edge.relationType})`;
      seasons.push({
        anilistId: edge.node.id,
        title: edgeTitle,
        relationType: edge.relationType,
        isCurrent: false,
        id: edge.node.id,
        name: edgeTitle,
        season_number: edge.node.id
      });
    }
  }
  
  return seasons;
};

export interface AnimeNameAndSeason {
  name: string;
  season: string;
}

export function getAnimeNameAndSeason(item: any, propSeason?: number): AnimeNameAndSeason {
  if (!item) return { name: '', season: '' };

  const rawTitle =
    (typeof item.title === 'string' ? item.title : null) ||
    item.title?.english ||
    item.name ||
    item.title?.romaji ||
    item.original_name ||
    'Anime';

  const isMovie =
    item.anime_format === 'movie' ||
    item.format === 'MOVIE' ||
    item.media_type === 'movie' ||
    item.anilist_raw?.format === 'MOVIE';

  if (isMovie) {
    return {
      name: rawTitle,
      season: 'Movie',
    };
  }

  // Look for explicit Season/Part/Arc patterns in the title
  const finalSeasonMatch = rawTitle.match(/Final\s*Season(?:\s*:\s*Part\s*(\d+)|\s+Part\s*(\d+))?/i);
  const seasonMatch =
    rawTitle.match(/(?:Season|S)\s*(\d+)/i) ||
    rawTitle.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
  const partMatch = rawTitle.match(/Part\s*(\d+)/i);
  const courMatch = rawTitle.match(/Cour\s*(\d+)/i);
  const arcMatch = rawTitle.match(/(?:The\s+)?([A-Za-z0-9\s'-]+Arc)/i);

  let seasonLabel = '';
  let cleanName = rawTitle;

  if (finalSeasonMatch) {
    const part = finalSeasonMatch[1] || finalSeasonMatch[2];
    seasonLabel = part ? `Final Season Part ${part}` : 'Final Season';
    cleanName = rawTitle.replace(/[:\s-]+Final\s*Season.*/i, '').trim();
  } else if (seasonMatch) {
    const sNum = seasonMatch[1];
    seasonLabel = `Season ${sNum}`;
    if (partMatch) {
      seasonLabel += ` Part ${partMatch[1]}`;
    }
    cleanName = rawTitle
      .replace(/[:\s-]+(?:Season|S)\s*\d+.*$/i, '')
      .replace(/[:\s-]+\d+(?:st|nd|rd|th)\s*Season.*$/i, '')
      .trim();
  } else if (arcMatch) {
    seasonLabel = arcMatch[1].trim();
    cleanName = rawTitle.replace(new RegExp(`[:\\s-]+${arcMatch[1]}.*`, 'i'), '').trim();
  } else if (partMatch) {
    seasonLabel = `Part ${partMatch[1]}`;
    cleanName = rawTitle.replace(/[:\s-]+Part\s*\d+.*$/i, '').trim();
  } else if (courMatch) {
    seasonLabel = `Cour ${courMatch[1]}`;
    cleanName = rawTitle.replace(/[:\s-]+Cour\s*\d+.*$/i, '').trim();
  } else {
    const sNum = item.tmdb_season || propSeason || (item.number_of_seasons === 1 ? 1 : 1);
    seasonLabel = `Season ${sNum}`;
  }

  // Fallback: If cleanName was wiped or too short, revert to rawTitle
  if (!cleanName || cleanName.length < 2) {
    cleanName = rawTitle;
  }

  return {
    name: cleanName,
    season: seasonLabel,
  };
}
