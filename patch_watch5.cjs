const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const replacement = `// Construct base episodes from AniList count
          const numEpisodes = details.number_of_episodes || 1;
          const streamingEps = details.anilist_raw?.streamingEpisodes || [];
          
          const anilistEpisodes = Array.from({ length: numEpisodes }, (_, i) => {
            const epNum = i + 1;
            // Try to find a matching streaming episode to extract the title
            // Usually titles are like "Episode 1 - Title" or "1 - Title"
            let epName = \`Episode \${epNum}\`;
            let epThumb = null;
            
            const match = streamingEps.find((se: any) => {
              return se.title?.includes(\`Episode \${epNum}\`) || se.title?.startsWith(\`\${epNum} -\`);
            });
            
            if (match) {
              const parts = match.title.split('-');
              if (parts.length > 1) {
                epName = parts.slice(1).join('-').trim();
              } else {
                epName = match.title;
              }
              epThumb = match.thumbnail;
            }
            
            return {
              episode_number: epNum,
              name: epName,
              overview: '',
              still_path: epThumb
            };
          });
          
          let mergedEpisodes = [...anilistEpisodes];`;

content = content.replace(/const numEpisodes = details\.number_of_episodes \|\| 1;[\s\S]*?let mergedEpisodes = \[\.\.\.anilistEpisodes\];/, replacement);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
