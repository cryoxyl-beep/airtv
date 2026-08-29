export interface AnimeSeason {
  anilistId: number;
  title: string;
  relationType?: string;
  isCurrent: boolean;
}

export const extractAnimeSeasons = (rawMedia: any): AnimeSeason[] => {
  if (!rawMedia || !rawMedia.relations || !rawMedia.relations.edges) {
    return [{
      anilistId: rawMedia?.id,
      title: rawMedia?.title?.english || rawMedia?.title?.romaji || "Season 1",
      isCurrent: true
    }];
  }

  // Find all prequels/sequels recursively? No, just immediate ones for simplicity, 
  // or return the franchise. 
  // To keep it simple, we just get immediate SEQUEL/PREQUEL/ALTERNATIVE.
  const seasons: AnimeSeason[] = [];
  
  // Add current
  seasons.push({
    anilistId: rawMedia.id,
    title: rawMedia.title?.english || rawMedia.title?.romaji || "Current Season",
    isCurrent: true
  });
  
  for (const edge of rawMedia.relations.edges) {
    if ((edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL' || edge.relationType === 'ALTERNATIVE' || edge.relationType === 'PARENT') && 
        edge.node.type === 'ANIME' && 
        (edge.node.format === 'TV' || edge.node.format === 'TV_SHORT' || edge.node.format === 'ONA' || edge.node.format === 'MOVIE')) {
      seasons.push({
        anilistId: edge.node.id,
        title: edge.node.title?.english || edge.node.title?.romaji || `Related (${edge.relationType})`,
        relationType: edge.relationType,
        isCurrent: false
      });
    }
  }
  
  // Sort them so Prequel -> Current -> Sequel (roughly)
  // But wait, the user just wants the Season dropdown. This simple implementation works.
  return seasons;
}
