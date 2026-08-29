const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

const target = `  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(\`/watch/tv/\${id}/\${newSeason}/1\`, { replace: false });
    } else {
                }
  };`;
const replacement = `  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(\`/watch/tv/\${id}/\${newSeason}/1\`, { replace: false });
    } else if (type === 'anime') {
      navigate(\`/anime/\${newSeason}\`, { replace: false });
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/WatchPage.tsx', code);
