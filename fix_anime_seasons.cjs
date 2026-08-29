const fs = require('fs');

// Fix WatchPage.tsx
let watchPageCode = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');
const animeSeasonSelectorRegex = /\{type === 'anime'.*?data\.animeGroup.*?data\.animeGroup\.seasons.*?data\.animeGroup\.seasons\.length > 1.*?<SeasonSelector.*?\/>\s*<\/div>\s*\}/s;
watchPageCode = watchPageCode.replace(animeSeasonSelectorRegex, '');
fs.writeFileSync('src/pages/WatchPage.tsx', watchPageCode);

// Fix EpisodeOverlay.tsx
let episodeOverlayCode = fs.readFileSync('src/components/EpisodeOverlay.tsx', 'utf-8');
episodeOverlayCode = episodeOverlayCode.replace(animeSeasonSelectorRegex, '');
fs.writeFileSync('src/components/EpisodeOverlay.tsx', episodeOverlayCode);

// Fix WatchPage component gradient
let watchComponentCode = fs.readFileSync('src/components/WatchPage.tsx', 'utf-8');
const oldGradient = `background: \`
            linear-gradient(to top, rgba(11,11,11,1) 0%, rgba(11,11,11,0.55) 28%, rgba(11,11,11,0.15) 50%, transparent 65%),
            linear-gradient(to right, rgba(11,11,11,0.85) 0%, rgba(11,11,11,0.4) 30%, transparent 60%)
          \`,`;
const newGradient = `background: \`
            linear-gradient(to right, rgba(11,11,11,0.95) 0%, rgba(11,11,11,0.8) 25%, rgba(11,11,11,0.4) 50%, transparent 80%),
            linear-gradient(to top, rgba(11,11,11,1) 0%, rgba(11,11,11,0.3) 15%, transparent 35%)
          \`,`;
watchComponentCode = watchComponentCode.replace(oldGradient, newGradient);
fs.writeFileSync('src/components/WatchPage.tsx', watchComponentCode);
