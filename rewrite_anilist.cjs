const fs = require('fs');
let code = fs.readFileSync('src/api/anilist.ts', 'utf-8');

const target = `        trailer { id site }
        streamingEpisodes {`;
const replacement = `        trailer { id site }
        relations {
          edges {
            relationType
            node {
              id
              type
              format
              title { romaji english }
            }
          }
        }
        streamingEpisodes {`;
code = code.replace(target, replacement);

fs.writeFileSync('src/api/anilist.ts', code);
