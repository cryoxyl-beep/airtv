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
}
