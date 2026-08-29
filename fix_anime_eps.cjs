const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const replacement = `
          const streamingEps = details.anilist_raw?.streamingEpisodes || [];
          
          let anilistEpisodes = [];
          if (streamingEps.length > 0) {
            anilistEpisodes = streamingEps.map((se, i) => {
              let epNum = i + 1;
              const match = se.title?.match(/Episode\\s+(\\d+)|^\\s*(\\d+)\\s*-/i);
              if (match) {
                epNum = parseInt(match[1] || match[2], 10);
              }
              
              let epName = \`Episode \${epNum}\`;
              if (se.title) {
                const parts = se.title.split('-');
                if (parts.length > 1) {
                  epName = parts.slice(1).join('-').trim();
                } else {
                  epName = se.title;
                }
              }
              
              return {
                episode_number: epNum,
                name: epName,
                overview: '',
                still_path: se.thumbnail
              };
            });
            // Ensure they are sorted
            anilistEpisodes.sort((a, b) => a.episode_number - b.episode_number);
          } else {
            anilistEpisodes = Array.from({ length: numEpisodes }, (_, i) => ({
              episode_number: i + 1,
              name: \`Episode \${i + 1}\`,
              overview: '',
              still_path: null
            }));
          }
`;

content = content.replace(
  /const streamingEps = details\.anilist_raw\?\.streamingEpisodes \|\| \[\];[\s\S]*?let mergedEpisodes = \[\.\.\.anilistEpisodes\];/m,
  replacement + "\n          let mergedEpisodes = [...anilistEpisodes];"
);

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('Fixed Anime absolute episode numbers parsing');
