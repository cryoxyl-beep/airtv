const fs = require('fs');
let code = fs.readFileSync('src/pages/PlayerPage.tsx', 'utf-8');

const target = `  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(\`/play/tv/\${id}/\${newSeason}/1\`, { replace: true });
    }
  };`;
const replacement = `  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(\`/play/tv/\${id}/\${newSeason}/1\`, { replace: true });
    } else if (type === 'anime') {
      navigate(\`/play/anime/\${newSeason}/1\`, { replace: true });
    }
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/PlayerPage.tsx', code);
