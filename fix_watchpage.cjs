const fs = require('fs');

let c = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

// 1. Remove isProviderActive and showEpisodeOverlay state
c = c.replace(/const \[isProviderActive, setIsProviderActive\] = useState\(false\);\n/, "");
c = c.replace(/const \[showEpisodeOverlay, setShowEpisodeOverlay\] = useState\(false\);\n/, "");

// 2. Remove EpisodeOverlay render block
c = c.replace(/\{\s*isProviderActive && showBottomSection && showEpisodeOverlay && \([\s\S]*?<\/EpisodeOverlay>\s*\)\s*\}/, "");

// 3. Update handleBack
c = c.replace(/const handleBack = \(\) => \{[\s\S]*?if \(window\.history\.length > 1\)/, "const handleBack = () => {\n    if (window.history.length > 1)");

// 4. Update onPlay and EpisodeList
c = c.replace(/onPlay=\{\(\) => setIsProviderActive\(true\)\}/, "onPlay={() => {\n            if (type === 'movie') {\n              navigate(`/play/movie/${id}`);\n            } else if (type === 'tv') {\n              navigate(`/play/tv/${id}/${activeSeason}/${activeEpisode}`);\n            } else if (type === 'anime') {\n              navigate(`/play/anime/${id}/${activeEpisode}`);\n            }\n          }}");

c = c.replace(/isProviderActive=\{isProviderActive\}\s*/, "");
c = c.replace(/providerIframeUrl=\{providerUrl\}\s*/, "");
c = c.replace(/onToggleEpisodes=\{\(\) => setShowEpisodeOverlay\(!showEpisodeOverlay\)\}\s*/, "");

// 5. Update handleEpisodeChange to navigate to /play/ route (user said: Every episode card click ... should navigate() to /play/:id/:season/:episode)
c = c.replace(/const handleEpisodeChange = \(newEpisode: number\) => \{[\s\S]*?if \(type === 'tv'\) \{\n\s*navigate\(`\/watch\/tv\/\$\{id\}\/\$\{activeSeason\}\/\$\{newEpisode\}`/, "const handleEpisodeChange = (newEpisode: number) => {\n    if (type === 'tv') {\n      navigate(`/play/tv/${id}/${activeSeason}/${newEpisode}`");
c = c.replace(/else if \(type === 'anime'\) \{\n\s*navigate\(`\/anime\/\$\{id\}\/\$\{newEpisode\}`/, "else if (type === 'anime') {\n      navigate(`/play/anime/${id}/${newEpisode}`");

// 6. Remove providerUrl calculation
c = c.replace(/let providerUrl: string \| null = null;[\s\S]*?\}\s*\}\s*const showBottomSection/, "const showBottomSection");

fs.writeFileSync('src/pages/WatchPage.tsx', c);
