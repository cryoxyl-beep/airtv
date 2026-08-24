const fs = require('fs');
let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

content = content.replace(
  "    throw new Error('AniList API error');",
  "    console.error('AniList API error:', response.status, await response.text());\n    throw new Error('AniList API error: ' + response.status);"
);

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
