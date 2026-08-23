const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const targetLogic = `  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(false);
      try {
        if (!id) throw new Error('No ID');
        
        let details;
        try {
          if (type === 'anime') {
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
                       return; // Navigation will trigger a new mount/effect
                    }
                 }
              }
            }`;

const replacementLogic = `  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(false);
      let isRedirecting = false;
      try {
        if (!id) throw new Error('No ID');
        
        let details;
        try {
          if (type === 'anime') {
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
                       isRedirecting = true;
                       navigate(\`/anime/\${prefId}\`, { replace: true });
                       return;
                    }
                 }
              }
            }`;

content = content.replace(targetLogic, replacementLogic);

const targetFinally = `      } catch (err: any) {
        console.error("Failed to load watch data:", err.message || err);
        setError(true);
      } finally {
        setLoading(false);
      }`;

const replacementFinally = `      } catch (err: any) {
        console.error("Failed to load watch data:", err.message || err);
        setError(true);
      } finally {
        if (!isRedirecting) {
          setLoading(false);
        }
      }`;

content = content.replace(targetFinally, replacementFinally);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
