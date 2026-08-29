const fs = require('fs');

// Fix WatchPage.tsx
let c = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');
c = c.replace(/useEffect\(\(\) => \{ console\.log\('PROVIDER URL CHANGED:', providerUrl\); \}, \[providerUrl\]\);\n/, "");
c = c.replace(/activeSeason=\{\(type === 'tv' \|\| type === 'anime'\) \? activeSeason : undefined\}/, "seasonNumber={(type === 'tv' || type === 'anime') ? activeSeason : undefined}");
c = c.replace(/activeEpisode=\{\(type === 'tv' \|\| type === 'anime'\) \? activeEpisode : undefined\}/, "episodeNumber={(type === 'tv' || type === 'anime') ? activeEpisode : undefined}");
fs.writeFileSync('src/pages/WatchPage.tsx', c);

console.log('Fixed lint errors');
