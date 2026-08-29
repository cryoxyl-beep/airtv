const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const oldEffect = `  useEffect(() => {
    if (season) setSeasonNumber(parseInt(season, 10));
    if (episode) setEpisodeNumber(parseInt(episode, 10));
  }, [season, episode]);`;

const newEffect = `  useEffect(() => {
    setSeasonNumber(season ? parseInt(season, 10) : 1);
    setEpisodeNumber(episode ? parseInt(episode, 10) : 1);
  }, [season, episode]);`;

content = content.replace(oldEffect, newEffect);

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('Fixed WatchPage useEffect fallback');
