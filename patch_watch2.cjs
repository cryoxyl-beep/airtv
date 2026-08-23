const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const replacement = `if ((type === 'tv' || type === 'anime') && details) {
          if (type === 'anime' && details.tmdb_id && details.media_type !== 'movie') {
            try {
              const seasons = details.seasons || [];
              let targetSeason = seasonNumber;
              const seasonExists = seasons.find((s: any) => s.season_number === targetSeason);
              
              if (!seasonExists && seasons.length > 0) {
                const validSeason = seasons.find((s: any) => s.season_number > 0) || seasons[0];
                targetSeason = validSeason.season_number;
                setSeasonNumber(targetSeason);
                setEpisodeNumber(1);
              }
              const season = await fetchTVSeason(details.tmdb_id, targetSeason);
              setSeasonData(season);
            } catch (e) {
              console.warn("Failed to fetch TMDB season data for anime", e);
            }
          }`;

content = content.replace(/if \(\(type === 'tv' \|\| type === 'anime'\) && details\) {[\s\S]*?if \(type === 'anime' && details\.tmdb_id\) {[\s\S]*?try {[\s\S]*?\/\/ Try to fetch TMDB details to get seasons[\s\S]*?const tmdbDetails = await fetchDetails\(details\.tmdb_id, 'tv'\);[\s\S]*?details\.seasons = tmdbDetails\.seasons;[\s\S]*?const seasons = details\.seasons \|\| \[\];[\s\S]*?let targetSeason = seasonNumber;[\s\S]*?const seasonExists = seasons\.find\(\(s: any\) => s\.season_number === targetSeason\);[\s\S]*?if \(\!seasonExists && seasons\.length > 0\) {[\s\S]*?const validSeason = seasons\.find\(\(s: any\) => s\.season_number > 0\) \|\| seasons\[0\];[\s\S]*?targetSeason = validSeason\.season_number;[\s\S]*?setSeasonNumber\(targetSeason\);[\s\S]*?setEpisodeNumber\(1\);[\s\S]*?}[\s\S]*?const season = await fetchTVSeason\(details\.tmdb_id, targetSeason\);[\s\S]*?setSeasonData\(season\);[\s\S]*?} catch \(e\) {[\s\S]*?console\.warn\("Failed to fetch TMDB season data for anime", e\);[\s\S]*?}[\s\S]*?}/, replacement);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
