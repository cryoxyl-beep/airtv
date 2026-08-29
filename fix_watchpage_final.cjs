const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

const target1 = `      const loadSeason = async () => {
                  const season = await fetchTVSeason(parseInt(id), activeSeason);
          setSeasonData(season);
        } catch (e: any) {`;
const replacement1 = `      const loadSeason = async () => {
        try {
          const season = await fetchTVSeason(parseInt(id), activeSeason);
          setSeasonData(season);
        } catch (e: any) {`;
code = code.replace(target1, replacement1);

const target2 = `  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(\`/watch/tv/\${id}/\${newSeason}/1\`, { replace: false });
    } else {
                }
  };`;
const replacement2 = `  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(\`/watch/tv/\${id}/\${newSeason}/1\`, { replace: false });
    } else if (type === 'anime') {
      navigate(\`/anime/\${newSeason}\`, { replace: false });
    }
  };`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/pages/WatchPage.tsx', code);
