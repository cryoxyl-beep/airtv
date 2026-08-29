const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

const target = `          } else {
            details = await fetchDetails(parseInt(id), type as 'movie' | 'tv');
          } else if (type === 'tv') {`;
          
const replacement = `          } else {
            details = await fetchDetails(parseInt(id), type as 'movie' | 'tv');
          }
          
          if (type === 'tv') {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/WatchPage.tsx', code);
