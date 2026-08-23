const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const newLogic = `
        if (type === 'anime') {
          // Construct base episodes from AniList count
          const numEpisodes = details.number_of_episodes || 1;
          const anilistEpisodes = Array.from({ length: numEpisodes }, (_, i) => ({
            episode_number: i + 1,
            name: \`Episode \${i + 1}\`,
            overview: '',
            still_path: null
          }));
          
          let mergedEpisodes = [...anilistEpisodes];
          
          if (details.tmdb_id && details.anime_format !== 'movie') {
            try {
              // Fribb gives us the exact TMDB season mapping
              const targetSeason = details.tmdb_season || 1;
              const tmdbSeasonData = await fetchTVSeason(details.tmdb_id, targetSeason);
              
              if (tmdbSeasonData && tmdbSeasonData.episodes) {
                // Merge TMDB thumbnails and names into our AniList episodes
                mergedEpisodes = mergedEpisodes.map(ep => {
                  // TMDB might not start at 1 if they use absolute numbering or weird season splits
                  // For now, match by episode_number 1:1 since that's standard
                  const tmdbEp = tmdbSeasonData.episodes.find((t: any) => t.episode_number === ep.episode_number);
                  return {
                    ...ep,
                    name: tmdbEp?.name && tmdbEp.name !== \`Episode \${ep.episode_number}\` ? tmdbEp.name : ep.name,
                    overview: tmdbEp?.overview || ep.overview,
                    still_path: tmdbEp?.still_path || null
                  };
                });
                
                // If TMDB has more episodes than AniList knows about, append them
                tmdbSeasonData.episodes.forEach((tmdbEp: any) => {
                  if (!mergedEpisodes.find(ep => ep.episode_number === tmdbEp.episode_number)) {
                    mergedEpisodes.push(tmdbEp);
                  }
                });
                // Sort to ensure order
                mergedEpisodes.sort((a, b) => a.episode_number - b.episode_number);
              }
            } catch (e) {
              console.warn("Failed to fetch TMDB season data for anime", e);
            }
          }
          
          setSeasonData({ episodes: mergedEpisodes });
          // Force seasonNumber to 1 to hide season selector logic if it's based on it
          setSeasonNumber(1);
          
        } else if (type === 'tv') {
          // Check if requested season exists
          const seasons = details.seasons || [];
          let targetSeason = seasonNumber;
          const seasonExists = seasons.find((s: any) => s.season_number === targetSeason);
          
          if (!seasonExists && seasons.length > 0) {
            // Default to the first valid season (prefer > 0)
            const validSeason = seasons.find((s: any) => s.season_number > 0) || seasons[0];
            targetSeason = validSeason.season_number;
            setSeasonNumber(targetSeason);
            setEpisodeNumber(1);
          }
          try {
            const season = await fetchTVSeason(parseInt(id!), targetSeason);
            setSeasonData(season);
          } catch (e: any) {
            console.error("fetchTVSeason failed:", e);
          }
        }
`;

content = content.replace(/if \(\(type === 'tv' \|\| type === 'anime'\) && details\) {[\s\S]*?\} catch \(e: any\) {[\s\S]*?console\.error\("fetchTVSeason failed:", e\);[\s\S]*?}[\s\S]*?}[\s\S]*?}/, newLogic);

// Modify the effect that watches seasonNumber to only run for TV
const effectReplace = `useEffect(() => {
    if (type === 'tv' && id && !loading && data) {
      const loadSeason = async () => {
        try {
          const season = await fetchTVSeason(parseInt(id), seasonNumber);
          setSeasonData(season);
        } catch (e: any) {
          console.error("fetchTVSeason failed:", e);
        }
      };
      loadSeason();
    }
  }, [seasonNumber, id, type]);`;

content = content.replace(/useEffect\(\(\) => {[\s\S]*?if \(\(type === 'tv' \|\| type === 'anime'\) && id && !loading && data\) {[\s\S]*?const loadSeason = async \(\) => {[\s\S]*?try {[\s\S]*?const tmdbId = type === 'anime' \? data\.tmdb_id : parseInt\(id\);[\s\S]*?if \(!tmdbId\) return;[\s\S]*?const season = await fetchTVSeason\(tmdbId, seasonNumber\);[\s\S]*?setSeasonData\(season\);[\s\S]*?} catch \(e: any\) {[\s\S]*?console\.error\("fetchTVSeason failed:", e\);[\s\S]*?}[\s\S]*?};[\s\S]*?loadSeason\(\);[\s\S]*?}[\s\S]*?}, \[seasonNumber, id, type\]\);/, effectReplace);

// Hide season selector for anime
content = content.replace(/\{\(type === 'tv' \|\| type === 'anime'\) && data\.seasons && seasonData && \(/, 
  `{(type === 'tv' || (type === 'anime' && seasonData?.episodes?.length > 1)) && seasonData && (`);
// For SeasonSelector specifically
content = content.replace(/\{\/\* Season Selector \*\/\}/, 
`{/* Season Selector */}
            {type === 'tv' && data.seasons && (
              <div className="mb-8">
                <SeasonSelector 
                  seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                  currentSeason={seasonNumber}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}`);
content = content.replace(/<div className="mb-8">\s*<SeasonSelector[\s\S]*?\/>\s*<\/div>/, ``);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
