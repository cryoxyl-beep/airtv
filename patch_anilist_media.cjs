const fs = require('fs');

let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

content = content.replace(/media_type: tmdbType, \/\/ Use the correct mapped type \(tv or movie\)/, 
`media_type: 'anime', // explicitly mark as anime
    anime_format: tmdbType, // but keep the format if we need to know if it's a movie or tv`);

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
