const fs = require('fs');

let tvdb = fs.readFileSync('src/api/tvdb.ts', 'utf-8');
tvdb = tvdb.replace(/const apiKey = import\.meta\.env\.VITE_TVDB_API_KEY/g, '// @ts-ignore\n      const apiKey = import.meta.env.VITE_TVDB_API_KEY');
fs.writeFileSync('src/api/tvdb.ts', tvdb);

let anilist = fs.readFileSync('src/api/anilist.ts', 'utf-8');
anilist = anilist.replace(/tmdb_season: fribb_mapping\?\.seasonMapping/g, 'tmdb_season: fribb_mapping?.seasonMappingTVDB');
fs.writeFileSync('src/api/anilist.ts', anilist);

