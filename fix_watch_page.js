const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

// Do not hide bottom section when isProviderActive
content = content.replace(
  "{showBottomSection && !isProviderActive && (",
  "{showBottomSection && ("
);

// Do not force full screen when isProviderActive
content = content.replace(
  "forceFullScreen={!showBottomSection || isProviderActive}",
  "forceFullScreen={!showBottomSection}"
);

// Show episode overlay only when `isProviderActive` and `showEpisodeOverlay` is true, but EpisodeOverlay itself should only cover the player!
// Actually EpisodeOverlay is absolute inset-0 on the relative WatchPage, so it covers everything. That's fine as a "Pause screen".
// But we want it to overlay the player area specifically or the whole screen. A full screen overlay is good.

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('fixed src/pages/WatchPage.tsx');
