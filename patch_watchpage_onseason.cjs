const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const regex = /onSeasonChange=\{\(newId\) \=\> \{\s*navigate\(\`\/anime\/\$\{newId\}\`\, \{ replace\: true \}\);\s*\}\}/;

const replacement = `onSeasonChange={(newId) => {
                       setAnimeSeasonPreference(data.animeGroup.groupId, newId);
                       navigate(\`/anime/\${newId}\`, { replace: true });
                    }}`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
