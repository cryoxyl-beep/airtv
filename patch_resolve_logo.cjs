const fs = require('fs');
let content = fs.readFileSync('src/api/tmdb.ts', 'utf8');

const regex = /const type = item\.media_type \|\| \(item\.first_air_date \? 'tv' : 'movie'\);/;
const replacement = `const baseType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const type = baseType === 'anime' ? (item.anime_format || 'tv') : baseType;`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/api/tmdb.ts', content, 'utf8');
