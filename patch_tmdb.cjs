const fs = require('fs');

let content = fs.readFileSync('src/api/tmdb.ts', 'utf8');

// 1. Add filter function at the top
const filterCode = `
export const isAnime = (item: any): boolean => {
  if (!item) return false;
  // If it comes from our AniList source, it's anime
  if (item.source === 'anilist') return false; 
  
  const isAnimation = item.genre_ids?.includes(16) || item.genres?.some((g: any) => g.id === 16);
  const isJP = item.origin_country?.includes('JP') || item.original_language === 'ja';
  
  if (isAnimation && isJP) return true;
  if (item.original_language === 'ja' && (item.media_type === 'tv' || item.type === 'Scripted')) return true;
  
  return false;
};

export const filterOutAnime = (results: any[]): any[] => {
  if (!Array.isArray(results)) return [];
  return results.filter(item => !isAnime(item));
};

`;

content = content.replace("const fetchOptions = {", filterCode + "\nconst fetchOptions = {");

// 2. Patch all fetch functions that return arrays of results to filter out anime
const fetchRegexes = [
  /export const fetchTrending = async \(\) => {[\s\S]*?return await res\.json\(\);\s*} catch/g,
  /export const fetchTop10 = async \(\) => {[\s\S]*?return await res\.json\(\);\s*} catch/g,
  /export const fetchAllTimeFavorites = async \(\) => {[\s\S]*?return await res\.json\(\);\s*} catch/g,
  /export const fetchByGenre = async \(genreId: number\) => {[\s\S]*?return await res\.json\(\);\s*} catch/g,
  /export const fetchTVByGenre = async \(genreId: number\) => {[\s\S]*?return await res\.json\(\);\s*} catch/g,
  /export const fetchByProvider = async \(providerId: number\) => {[\s\S]*?return await res\.json\(\);\s*} catch/g,
  /export const fetchTVByProvider = async \(providerId: number\) => {[\s\S]*?return await res\.json\(\);\s*} catch/g,
];

fetchRegexes.forEach(regex => {
  content = content.replace(regex, (match) => {
    return match.replace(/return await res\.json\(\);/, `const data = await res.json();\n    if (data && data.results) {\n      data.results = filterOutAnime(data.results);\n    }\n    return data;`);
  });
});

// 3. Patch resolveLogo to handle AniList items
content = content.replace(/export const resolveLogo = async \(item: any\): Promise<string \| null> => {/, `export const resolveLogo = async (item: any): Promise<string | null> => {
  if (item?.source === 'anilist' && item.tmdb_id) {
    item = { ...item, id: item.tmdb_id };
  }
`);

// 4. Patch getCachedLogo to handle AniList items
content = content.replace(/export const getCachedLogo = \(item: any\): string \| null => {/, `export const getCachedLogo = (item: any): string | null => {
  if (item?.source === 'anilist' && item.tmdb_id) {
    item = { ...item, id: item.tmdb_id };
  }
`);

fs.writeFileSync('src/api/tmdb.ts', content, 'utf8');
console.log('Patched tmdb.ts');
