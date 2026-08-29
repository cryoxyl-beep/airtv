const fs = require('fs');
let code = fs.readFileSync('src/api/fribb.ts', 'utf-8');

const target = `  anilistId: number;
  tmdbTvId?: number;
  tmdbMovieId?: number;
  seasonMapping?: number;
  mappingFound: boolean;
  type: string;`;
const replacement = `  anilistId: number;
  malId?: number;
  tvdbId?: number;
  tmdbTvId?: number;
  tmdbMovieId?: number;
  seasonMappingTVDB?: number;
  seasonMappingTMDB?: number;
  mappingFound: boolean;
  type: string;`;
code = code.replace(target, replacement);

const target2 = `          const mapping: FribbMapping = {
            anilistId: item.anilist_id,
            mappingFound: !!item.themoviedb_id,
            type: item.type || 'TV'
          };`;
const replacement2 = `          const mapping: FribbMapping = {
            anilistId: item.anilist_id,
            malId: item.mal_id,
            tvdbId: item.tvdb_id,
            mappingFound: !!item.themoviedb_id,
            type: item.type || 'TV'
          };`;
code = code.replace(target2, replacement2);

const target3 = `          if (item.season?.tmdb) {
            mapping.seasonMapping = item.season.tmdb;
          }`;
const replacement3 = `          if (item.season?.tmdb) {
            mapping.seasonMappingTMDB = item.season.tmdb;
          }
          if (item.season?.tvdb) {
            mapping.seasonMappingTVDB = item.season.tvdb;
          }`;
code = code.replace(target3, replacement3);

fs.writeFileSync('src/api/fribb.ts', code);
