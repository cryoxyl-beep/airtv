const fs = require('fs');

let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

// Add import
code = code.replace(/import \{ fetchDetails, fetchTVSeason, fetchTrailer, IMAGE_BASE_URL \} from '\.\.\/api\/tmdb';/, 
  "import { fetchDetails, fetchTVSeason, fetchTrailer, IMAGE_BASE_URL } from '../api/tmdb';\nimport { buildAnimeEpisodeList } from '../api/animeResolver';\nimport { extractAnimeSeasons } from '../api/animeRelations';");

// Remove the old anime block and replace it
const targetRegex = /if \(type === 'anime'\) \{[\s\S]*?setSeasonData\(\{ episodes: mergedEpisodes \}\);\n\s*\/\/ Force activeSeason to 1 to hide season selector logic if it's based on it\n\s*\}/;

const replacement = `if (type === 'anime') {
          const numEpisodes = details.number_of_episodes || 12;
          const mergedEpisodes = await buildAnimeEpisodeList(parseInt(id), numEpisodes);
          details.animeGroup = { seasons: extractAnimeSeasons(details.anilist_raw) };
          setSeasonData({ episodes: mergedEpisodes });
        }`;

code = code.replace(targetRegex, replacement);

fs.writeFileSync('src/pages/WatchPage.tsx', code);
