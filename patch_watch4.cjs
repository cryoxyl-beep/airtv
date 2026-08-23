const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const regex = /\/\/ Merge TMDB thumbnails and names into our AniList episodes[\s\S]*?\/\/ Sort to ensure order\s*mergedEpisodes\.sort\(\(a, b\) => a\.episode_number - b\.episode_number\);/g;

const replacement = `// Merge ONLY TMDB thumbnails into our AniList episodes
                mergedEpisodes = mergedEpisodes.map(ep => {
                  const tmdbEp = tmdbSeasonData.episodes.find((t: any) => t.episode_number === ep.episode_number);
                  return {
                    ...ep,
                    still_path: tmdbEp?.still_path || null
                  };
                });`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
