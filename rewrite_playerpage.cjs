const fs = require('fs');
let code = fs.readFileSync('src/pages/PlayerPage.tsx', 'utf-8');

code = code.replace(/import \{ fetchDetails, fetchTVSeason \} from '\.\.\/api\/tmdb';/, 
  "import { fetchDetails, fetchTVSeason } from '../api/tmdb';\nimport { buildAnimeEpisodeList } from '../api/animeResolver';\nimport { extractAnimeSeasons } from '../api/animeRelations';");

const target = `            // Generate basic episode array for anime if we don't have tmdb-like season format
            const numEpisodes = details.number_of_episodes || 1;
            const streamingEps = details.anilist_raw?.streamingEpisodes || [];
            
            let anilistEpisodes = [];
            if (streamingEps.length > 0) {
              anilistEpisodes = streamingEps.map((se: any) => {
                const epMatch = se.title.match(/Episode (\\d+)/i);
                const epNum = epMatch ? parseInt(epMatch[1]) : 1;
                const epName = se.title.replace(/Episode \\d+ - /i, '');
                return {
                  episode_number: epNum,
                  name: epName,
                  overview: '',
                  still_path: se.thumbnail
                };
              });
              anilistEpisodes.sort((a: any, b: any) => a.episode_number - b.episode_number);
            } else {
              anilistEpisodes = Array.from({ length: numEpisodes }, (_, i) => ({
                episode_number: i + 1,
                name: \`Episode \${i + 1}\`,
                overview: '',
                still_path: null
              }));
            }
            setSeasonData({ episodes: anilistEpisodes });`;

const replacement = `            const numEpisodes = details.number_of_episodes || 1;
            const mergedEpisodes = await buildAnimeEpisodeList(parseInt(id), numEpisodes);
            details.animeGroup = { seasons: extractAnimeSeasons(details.anilist_raw) };
            setSeasonData({ episodes: mergedEpisodes });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/PlayerPage.tsx', code);
