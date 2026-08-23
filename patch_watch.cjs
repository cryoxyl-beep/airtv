const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

content = content.replace(/details\.media_type = 'tv';/, `details.media_type = 'anime';`);
content = content.replace(/if \(type === 'anime' && details\.tmdb_id && details\.media_type !== 'movie'\) {/, 
  `if (type === 'anime' && details.tmdb_id && details.anime_format !== 'movie') {`);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
