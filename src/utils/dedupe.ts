export const getFranchiseKey = (titleOrName: string = ''): string => {
  if (!titleOrName) return '';
  const clean = titleOrName.toLowerCase().replace(/[^\w\s:\-\–\—(]/g, ' ');
  const prefix = clean.split(/[:\-\–\—(]/)[0];
  return prefix
    .replace(/\b(season|part|cour|arc|final season|the final season|movie|the movie|film|ova|special|series|animation|act)\b/gi, '')
    .replace(/\b(\d+|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|final|ii|iii|iv|v|vi)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const dedupeItems = <T extends any>(items: T[]): T[] => {
  if (!Array.isArray(items)) return [];
  const seenIds = new Set<any>();
  const seenTmdb = new Set<any>();
  const seenFranchise = new Set<string>();
  const seenBackdrops = new Set<string>();

  return items.filter((item: any) => {
    if (!item) return false;
    const id = item.id;
    if (id && seenIds.has(id)) return false;

    const tmdbId = item.tmdb_id || item.fribb_mapping?.tmdbTvId || item.fribb_mapping?.tmdbMovieId || (item.source !== 'anilist' ? item.id : null);
    if (tmdbId && seenTmdb.has(tmdbId)) return false;

    const backdrop = item.backdrop_path;
    if (backdrop && seenBackdrops.has(backdrop)) return false;

    const rawTitle = item.title || item.name || '';
    const franchiseKey = getFranchiseKey(rawTitle);
    if (franchiseKey.length >= 4 && seenFranchise.has(franchiseKey)) {
      return false;
    }

    if (id) seenIds.add(id);
    if (tmdbId) seenTmdb.add(tmdbId);
    if (backdrop) seenBackdrops.add(backdrop);
    if (franchiseKey.length >= 4) seenFranchise.add(franchiseKey);

    return true;
  });
};
