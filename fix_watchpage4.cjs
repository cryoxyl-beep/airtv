const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

const target = code.substring(code.indexOf('const loadContent = async () => {'), code.indexOf('    loadContent();') + 18);

const replacement = `const loadContent = async () => {
      setLoading(true);
      setError(false);
      let isRedirecting = false;
      try {
        if (!id) throw new Error('No ID');
        
        let details;
        if (type === 'anime') {
          details = await fetchAnimeDetails(parseInt(id));
          if (details) {
            const numEpisodes = details.number_of_episodes || 12;
            const mergedEpisodes = await buildAnimeEpisodeList(parseInt(id), numEpisodes);
            details.animeGroup = { seasons: extractAnimeSeasons(details.anilist_raw) };
            setSeasonData({ episodes: mergedEpisodes });
          }
        } else {
          details = await fetchDetails(parseInt(id), type as 'movie' | 'tv');
        }
        
        setData(details);

        if (type === 'tv') {
          const seasons = details.seasons || [];
          let targetSeason = activeSeason;
          const seasonExists = seasons.find((s: any) => s.season_number === targetSeason);
          
          if (!seasonExists && seasons.length > 0) {
            const validSeason = seasons.find((s: any) => s.season_number > 0) || seasons[0];
            targetSeason = validSeason.season_number;
            isRedirecting = true;
            navigate(\`/watch/tv/\${id}/\${targetSeason}/1\`, { replace: true });
            return;
          }
          
          try {
            const season = await fetchTVSeason(parseInt(id), targetSeason);
            setSeasonData(season);
          } catch (e: any) {
            console.error("fetchTVSeason failed:", e);
          }
        }
      } catch (err: any) {
        console.error("Failed to load watch data:", err.message || err);
        setError(true);
      } finally {
        if (!isRedirecting) {
          setLoading(false);
        }
      }
    };
    loadContent();`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/WatchPage.tsx', code);
