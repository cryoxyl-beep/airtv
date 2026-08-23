const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const target = `<EpisodeList 
              episodes={seasonData.episodes || []} 
              currentEpisode={episodeNumber}
              onEpisodeSelect={handleEpisodeChange}
            />`;

const replacement = `<EpisodeList 
              episodes={seasonData.episodes || []} 
              currentEpisode={episodeNumber}
              onEpisodeSelect={handleEpisodeChange}
              isAnime={type === 'anime'}
            />`;

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
