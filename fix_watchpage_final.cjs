const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

// 1. Remove the useState for seasonNumber and episodeNumber
content = content.replace(
  "const [seasonNumber, setSeasonNumber] = useState(season ? parseInt(season, 10) : 1);",
  "// Derived directly from the route, no React state\n  const activeSeason = season ? parseInt(season, 10) : 1;"
);

content = content.replace(
  "const [episodeNumber, setEpisodeNumber] = useState(episode ? parseInt(episode, 10) : 1);",
  "const activeEpisode = episode ? parseInt(episode, 10) : 1;"
);

// 2. Remove the useEffect that synced them
content = content.replace(
  /useEffect\(\(\) => \{\s*setSeasonNumber\(.*?\);\s*setEpisodeNumber\(.*?\);\s*\}, \[season, episode\]\);/g,
  ""
);

// 3. Replace all usages of seasonNumber with activeSeason
content = content.replace(/seasonNumber/g, "activeSeason");
// 4. Replace all usages of episodeNumber with activeEpisode
content = content.replace(/episodeNumber/g, "activeEpisode");

// 5. Remove any leftover setSeasonNumber / setEpisodeNumber calls
content = content.replace(/setSeasonNumber\(.*?\);/g, "");
content = content.replace(/setEpisodeNumber\(.*?\);/g, "");

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('Fixed WatchPage completely');
