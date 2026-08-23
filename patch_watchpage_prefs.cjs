const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

if (!content.includes('getAnimeSeasonPreference')) {
  // Add imports
  content = content.replace(
    "import { fetchDetails, fetchTVSeason, fetchTrailer, IMAGE_BASE_URL } from '../api/tmdb';",
    "import { fetchDetails, fetchTVSeason, fetchTrailer, IMAGE_BASE_URL } from '../api/tmdb';\nimport { getAnimeSeasonPreference, setAnimeSeasonPreference } from '../utils/preferences';"
  );
  
  // Inject redirect logic
  const targetLogic = `          if (type === 'anime') {
            details = await fetchAnimeDetails(parseInt(id));
            if (details) {
              details.source = 'anilist';
              details.media_type = 'anime';
              details.animeGroup = groupCache.get(parseInt(id));
            }
          }`;
          
  const replacementLogic = `          if (type === 'anime') {
            details = await fetchAnimeDetails(parseInt(id));
            if (details) {
              details.source = 'anilist';
              details.media_type = 'anime';
              const group = groupCache.get(parseInt(id));
              details.animeGroup = group;
              
              if (group) {
                 const prefId = getAnimeSeasonPreference(group.groupId);
                 if (prefId && prefId !== parseInt(id)) {
                    const exists = group.seasons.find((s: any) => s.anilistId === prefId);
                    if (exists) {
                       navigate(\`/anime/\${prefId}\`, { replace: true });
                       return;
                    }
                 }
              }
            }
          }`;
          
  content = content.replace(targetLogic, replacementLogic);
  
  // Update onSeasonChange
  const targetOnSeasonChange = `onSeasonChange={(newId) => { 
                       navigate(\`/anime/\${newId}\`, { replace: true });
                    }}`;
  const replacementOnSeasonChange = `onSeasonChange={(newId) => { 
                       setAnimeSeasonPreference(data.animeGroup.groupId, newId);
                       navigate(\`/anime/\${newId}\`, { replace: true });
                    }}`;
                    
  content = content.replace(targetOnSeasonChange, replacementOnSeasonChange);
  
  fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
}
