const fs = require('fs');

let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

content = content.replace(/const tmdbType = tmdbMapping\?.type \|\| 'tv';/, 
`const tmdbType = tmdbMapping?.type || 'tv';
  const tmdbSeason = tmdbMapping?.season;`);

content = content.replace(/tmdb_id: tmdbId, \/\/ keep track of the tmdb ID/, 
`tmdb_id: tmdbId, // keep track of the tmdb ID
    tmdb_season: tmdbSeason, // keep track of mapped tmdb season`);

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
