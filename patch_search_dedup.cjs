const fs = require('fs');
let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

content = content.replace(
  "return { results: await deduplicateAnimeList(results.filter(Boolean)) };",
  "return { results: results.filter(Boolean) };"
);

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
