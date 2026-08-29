const fs = require('fs');
let c = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

c = c.replace(
  "            targetSeason = validSeason.season_number;\n            \n            \n          }",
  "            targetSeason = validSeason.season_number;\n            isRedirecting = true;\n            navigate(`/watch/tv/${id}/${targetSeason}/1`, { replace: true });\n            return;\n          }"
);

fs.writeFileSync('src/pages/WatchPage.tsx', c);
