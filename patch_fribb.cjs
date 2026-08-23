const fs = require('fs');

let content = fs.readFileSync('src/api/fribb.ts', 'utf8');

const parseCode = `
      for (const item of data) {
        if (item.anilist_id && item.themoviedb_id) {
          const tmdbId = item.themoviedb_id.tv || item.themoviedb_id.movie || (typeof item.themoviedb_id === 'number' ? item.themoviedb_id : null);
          const type = item.themoviedb_id.movie ? 'movie' : 'tv';
          if (tmdbId) {
            anilistToTmdb.set(item.anilist_id, { id: tmdbId, type });
            tmdbToAnilist.set(tmdbId, { id: item.anilist_id, type });
          }
        }
      }
`;

content = content.replace(/for \(const item of data\) {[\s\S]*?}/, parseCode);

// Also we should make getTmdbId async if we want to ensure init
content = content.replace(/export const getTmdbId = \(anilistId: number\): number \| undefined => {[\s\S]*?};/, 
`export const getTmdbId = async (anilistId: number): Promise<{ id: number, type: string } | undefined> => {
  await initFribb();
  return anilistToTmdb.get(anilistId);
};`);

content = content.replace(/let anilistToTmdb = new Map<number, number>\(\);/, `let anilistToTmdb = new Map<number, {id: number, type: string}>();`);
content = content.replace(/let tmdbToAnilist = new Map<number, number>\(\);/, `let tmdbToAnilist = new Map<number, {id: number, type: string}>();`);

fs.writeFileSync('src/api/fribb.ts', content, 'utf8');
