const fs = require('fs');

let content = fs.readFileSync('src/api/fribb.ts', 'utf8');

content = content.replace(/let tmdbToAnilist = new Map<number, {id: number, type: string}>\(\);/, `let tmdbToAnilist = new Map<number, {id: number, type: string, season?: number}>();`);
content = content.replace(/let anilistToTmdb = new Map<number, {id: number, type: string}>\(\);/, `let anilistToTmdb = new Map<number, {id: number, type: string, season?: number}>();`);
content = content.replace(/export const getTmdbId = async \(anilistId: number\): Promise<{ id: number, type: string } \| undefined> => {/, `export const getTmdbId = async (anilistId: number): Promise<{ id: number, type: string, season?: number } | undefined> => {`);

const loopReplacement = `for (const item of data) {
        if (item.anilist_id && item.themoviedb_id) {
          const tmdbId = item.themoviedb_id.tv || item.themoviedb_id.movie || (typeof item.themoviedb_id === 'number' ? item.themoviedb_id : null);
          const type = item.themoviedb_id.movie ? 'movie' : 'tv';
          const season = item.season?.tmdb;
          if (tmdbId) {
            anilistToTmdb.set(item.anilist_id, { id: tmdbId, type, season });
            tmdbToAnilist.set(tmdbId, { id: item.anilist_id, type, season });
          }
        }
      }`;

content = content.replace(/for \(const item of data\) {[\s\S]*?}/, loopReplacement);

fs.writeFileSync('src/api/fribb.ts', content, 'utf8');
