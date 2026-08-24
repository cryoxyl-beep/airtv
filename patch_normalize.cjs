const fs = require('fs');
let content = fs.readFileSync('src/api/anilist.ts', 'utf8');
content = content.replace(/const mapping = await resolveAnimeMapping\(media\.id\);/, "buildAnimeGroup(media);\n  const mapping = await resolveAnimeMapping(media.id);");
fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
