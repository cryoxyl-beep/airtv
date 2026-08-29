const fs = require('fs');
let code = fs.readFileSync('src/pages/PlayerPage.tsx', 'utf-8');

const oldAnimeLogic = `          if (details) {            
            // Generate basic episode array for anime if we don't have tmdb-like season format
            const numEpisodes = details.number_of_episodes || 1;
            const streamingEps = details.anilist_raw?.streamingEpisodes || [];
            
            let anilistEpisodes = [];
            if (streamingEps.length > 0) {
              anilistEpisodes = streamingEps.map((se: any, i: number) => {
                let epNum = i + 1;
                const match = se.title?.match(/Episode\\s+(\\d+)|^\\s*(\\d+)\\s*-/i);
                if (match) epNum = parseInt(match[1] || match[2], 10);
                
                let epName = \`Episode \${epNum}\`;
                if (se.title) {
                  const parts = se.title.split('-');
                  if (parts.length > 1) epName = parts.slice(1).join('-').trim();
                  else epName = se.title;
                }
                return {
                  id: \`ep-\${epNum}\`,
                  episode_number: epNum,
                  name: epName,
                  still_path: se.thumbnail
                };
              });
            } else {
              anilistEpisodes = Array.from({ length: numEpisodes }, (_, i) => ({
                id: \`ep-\${i + 1}\`,
                episode_number: i + 1,
                name: \`Episode \${i + 1}\`,
                still_path: details.backdrop_path || details.poster_path
              }));
            }
            setSeasonData({ episodes: anilistEpisodes });
          }`;

const newAnimeLogic = `          if (details) {
            const numEpisodes = details.number_of_episodes || 12;
            const mergedEpisodes = await buildAnimeEpisodeList(parseInt(id), numEpisodes);
            details.animeGroup = { seasons: extractAnimeSeasons(details.anilist_raw) };
            setSeasonData({ episodes: mergedEpisodes });
          }`;

// Let's use regex to replace everything between `if (details) {` and `} else {` just in case the string matching is flaky
code = code.replace(/if \(details\) \{[\s\S]*?setSeasonData\(\{ episodes: [^}]+\} \};\s*\}/, newAnimeLogic);
if (!code.includes('mergedEpisodes')) {
  // Try another approach
  code = code.replace(/if\s*\(details\)\s*\{[\s\S]*?(?=\}\s*else\s*\{\s*details = await fetchDetails)/, newAnimeLogic + '\n        ');
}

fs.writeFileSync('src/pages/PlayerPage.tsx', code);
