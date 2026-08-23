const fs = require('fs');

let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

content = content.replace("import { getTmdbId } from './fribb';", "import { getTmdbId } from './fribb';\nimport { fetchDetails } from './tmdb';");

const normalizeCode = `
const normalizeAniListToTmdb = async (media: any): Promise<any> => {
  if (!media) return null;
  
  const tmdbMapping = await getTmdbId(media.id);
  const tmdbId = tmdbMapping?.id;
  const tmdbType = tmdbMapping?.type || 'tv';
  
  let tmdbData: any = null;
  if (tmdbId) {
    try {
      tmdbData = await fetchDetails(tmdbId, tmdbType);
    } catch (e) {
      console.warn('Failed to fetch TMDB enrichment for', tmdbId);
    }
  } else {
    console.log('[Fribb] NO TMDB MATCH for AniList ID:', media.id, media.title?.english || media.title?.romaji);
  }

  // Use TMDB data if available, fallback to AniList
  let poster_path = tmdbData?.poster_path || media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = tmdbData?.backdrop_path || media.bannerImage || media.coverImage?.extraLarge;
  
  // Quick fix for absolute URLs getting prepended with TMDB base URL in components
  // Components usually do \`\${IMAGE_BASE_URL}\${item.poster_path}\`
  // If we return the AniList URL, we can't easily stop the component from prepending, 
  // UNLESS we fix the component. But the user says "Use the resolved TMDB ID to obtain poster... from TMDB"
  // So tmdbData.poster_path will be a relative path like '/xyz.jpg', which works perfectly!
  
  const title = media.title?.english || media.title?.romaji || media.title?.native;
  if (tmdbId) {
    console.log('[AniList] title:', title, '[AniList] ID:', media.id, '[Fribb] matched AniList ID:', media.id, '[Fribb] resolved TMDB ID:', tmdbId);
  }

  return {
    id: media.id,
    tmdb_id: tmdbId, // keep track of the tmdb ID
    source: 'anilist',
    media_type: tmdbType, // Use the correct mapped type (tv or movie)
    title: title,
    original_title: media.title?.native,
    name: title,
    original_name: media.title?.native,
    overview: media.description?.replace(/<[^>]*>?/gm, ''), // strip html tags
    poster_path: poster_path,
    backdrop_path: backdrop_path,
    vote_average: media.averageScore ? media.averageScore / 10 : 0, // convert 0-100 to 0-10
    first_air_date: media.startDate?.year ? \`\${media.startDate.year}-\${String(media.startDate.month).padStart(2, '0')}-\${String(media.startDate.day).padStart(2, '0')}\` : undefined,
    genre_ids: [], 
    genres: media.genres?.map((g: string) => ({ id: g, name: g })) || [],
    status: media.status === 'RELEASING' ? 'Returning Series' : (media.status === 'FINISHED' ? 'Ended' : media.status),
    number_of_episodes: media.episodes,
    trailer: media.trailer?.site === 'youtube' ? media.trailer.id : null,
    anilist_raw: media,
    // Add seasons if we have TMDB data so episodes work
    seasons: tmdbData?.seasons
  };
};
`;

content = content.replace(/const normalizeAniListToTmdb = \(media: any\): any => {[\s\S]*?};/, normalizeCode);

// Now patch all the fetch functions to use Promise.all
content = content.replace(/return {\n\s*results: \(data\.data\?\.Page\?\.media \|\| \[\]\)\.map\(normalizeAniListToTmdb\)\n\s*};/g, 
  `const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));\n    return { results: results.filter(Boolean) };`);

content = content.replace(/return normalizeAniListToTmdb\(data\.data\?\.Media\);/g, `return await normalizeAniListToTmdb(data.data?.Media);`);

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
