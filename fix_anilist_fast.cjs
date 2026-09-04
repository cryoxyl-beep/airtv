const fs = require('fs');
let code = fs.readFileSync('src/api/anilist.ts', 'utf-8');

// Update normalizeAniListToTmdb
code = code.replace(
  'const normalizeAniListToTmdb = async (media: any): Promise<any> => {',
  'const normalizeAniListToTmdb = async (media: any, skipTmdbImages: boolean = false): Promise<any> => {'
);

code = code.replace(
  'if (tmdbId && tmdbType) {',
  'if (!skipTmdbImages && tmdbId && tmdbType) {'
);

// Update all the fetch functions
const updates = [
  { func: 'fetchTrendingAnime = async (perPage = 10)', to: 'fetchTrendingAnime = async (perPage = 10, skipTmdbImages = false)' },
  { func: 'fetchNewlyAddedAnime = async (perPage = 10)', to: 'fetchNewlyAddedAnime = async (perPage = 10, skipTmdbImages = false)' },
  { func: 'fetchAnimeByGenre = async (genre: string, perPage = 20)', to: 'fetchAnimeByGenre = async (genre: string, perPage = 20, skipTmdbImages = false)' },
  { func: 'searchAnime = async (search: string, perPage = 20)', to: 'searchAnime = async (search: string, perPage = 20, skipTmdbImages = false)' }
];

for (const u of updates) {
  code = code.replace(`export const ${u.func} => {`, `export const ${u.to} => {`);
}

// Replace the loop logic in all these functions
const oldLoop = `    const mediaItems = data.data?.Page?.media || [];
    const results = [];
    for (const item of mediaItems) {
      results.push(await normalizeAniListToTmdb(item));
      // Add a tiny delay to prevent overwhelming TMDB connections
      await sleep(25);
    }`;

const newLoop = `    const mediaItems = data.data?.Page?.media || [];
    const results = [];
    for (const item of mediaItems) {
      results.push(await normalizeAniListToTmdb(item, skipTmdbImages));
      // Add a tiny delay to prevent overwhelming TMDB connections if fetching images
      if (!skipTmdbImages) {
        await sleep(25);
      }
    }`;

code = code.split(oldLoop).join(newLoop);

fs.writeFileSync('src/api/anilist.ts', code);
