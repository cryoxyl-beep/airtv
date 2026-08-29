const fs = require('fs');

let c = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

c = c.replace(/\{isProviderActive && showBottomSection && showEpisodeOverlay && \([\s\S]*?<\/EpisodeOverlay>\s*\)\s*\}/, "");
// also clean up WatchPageContent to remove the leftover `{isProviderActive && ...` in case it failed
c = c.replace(/\{isProviderActive && showBottomSection && showEpisodeOverlay && \([\s\S]*?<\/EpisodeOverlay>\s*\)\s*\}/, "");

fs.writeFileSync('src/pages/WatchPage.tsx', c);
