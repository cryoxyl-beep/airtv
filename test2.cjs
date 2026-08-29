const fs = require('fs');
let c = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');
c = c.replace(
  "export default function WatchPage({ item, type, seasonNumber, episodeNumber, seasonData, forceFullScreen, onPlay, isProviderActive, providerIframeUrl, onToggleEpisodes }: WatchPageProps) {",
  "export default function WatchPage({ item, type, seasonNumber, episodeNumber, seasonData, forceFullScreen, onPlay, isProviderActive, providerIframeUrl, onToggleEpisodes }: WatchPageProps) { console.log('WatchPageContent rendered with providerIframeUrl:', providerIframeUrl);"
);
fs.writeFileSync('src/components/WatchPage.tsx', c);
