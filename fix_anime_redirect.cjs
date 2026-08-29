const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const oldLogic = `              if (group) {
                 const prefId = getAnimeSeasonPreference(group.groupId);
                 if (prefId && prefId !== parseInt(id)) {
                    const exists = group.seasons.find((s: any) => s.anilistId === prefId);
                    if (exists) {
                       isRedirecting = true;
                       navigate(\`/anime/\${prefId}\`, { replace: true });
                       return;
                    }
                 }
              }`;

const newLogic = `              if (group && !episode) {
                 const prefId = getAnimeSeasonPreference(group.groupId);
                 if (prefId && prefId !== parseInt(id)) {
                    const exists = group.seasons.find((s: any) => s.anilistId === prefId);
                    if (exists) {
                       isRedirecting = true;
                       navigate(\`/anime/\${prefId}\`, { replace: true });
                       return;
                    }
                 }
              }`;

content = content.replace(oldLogic, newLogic);

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('Fixed Anime preference redirect');
