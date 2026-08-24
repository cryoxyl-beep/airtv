const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

// Add imports
content = content.replace(
  "import WatchPageContent from '../components/WatchPage';",
  "import WatchPageContent from '../components/WatchPage';\nimport EpisodeOverlay from '../components/EpisodeOverlay';\nimport { buildMovieProviderUrl, buildSeriesProviderUrl, buildAnimeProviderUrl } from '../utils/providers';"
);

// Add state to WatchPage
content = content.replace(
  "const [episodeNumber, setEpisodeNumber] = useState(1);",
  "const [episodeNumber, setEpisodeNumber] = useState(1);\n  const [isProviderActive, setIsProviderActive] = useState(false);\n  const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);"
);

// Modify handleBack
content = content.replace(
  "const handleBack = () => {\n    if (window.history.length > 1) {\n      navigate(-1);\n    } else {\n      navigate('/');\n    }\n  };",
  "const handleBack = () => {\n    if (isProviderActive) {\n      setIsProviderActive(false);\n      setShowEpisodeOverlay(false);\n      return;\n    }\n    if (window.history.length > 1) {\n      navigate(-1);\n    } else {\n      navigate('/');\n    }\n  };"
);

// Build Provider URL
const providerLogic = `
  let providerUrl: string | null = null;
  if (data) {
    if (type === 'movie') {
      providerUrl = buildMovieProviderUrl('vidnest', data.id);
    } else if (type === 'tv') {
      providerUrl = buildSeriesProviderUrl('vidnest', data.id, seasonNumber, episodeNumber);
    } else if (type === 'anime') {
      const malId = data.mal_id || data.idmal || data.id_mal;
      providerUrl = buildAnimeProviderUrl('vidnest', data.id, malId, episodeNumber, 'sub');
    }
  }
`;

content = content.replace(
  "const showBottomSection = ((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 1) || (type === 'anime' && data?.animeGroup && data.animeGroup.seasons && data.animeGroup.seasons.length > 1));",
  providerLogic + "\n  const showBottomSection = ((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 1) || (type === 'anime' && data?.animeGroup && data.animeGroup.seasons && data.animeGroup.seasons.length > 1));"
);

// Pass props to WatchPageContent
content = content.replace(
  "forceFullScreen={!showBottomSection}",
  "forceFullScreen={!showBottomSection || isProviderActive}\n          onPlay={() => setIsProviderActive(true)}\n          isProviderActive={isProviderActive}\n          providerIframeUrl={providerUrl}\n          onToggleEpisodes={() => setShowEpisodeOverlay(!showEpisodeOverlay)}"
);

// Add the EpisodeOverlay conditionally
content = content.replace(
  "{/* Details & Episode Selection Area */}",
  `{isProviderActive && showBottomSection && showEpisodeOverlay && (
        <EpisodeOverlay 
          type={type as any}
          data={data}
          seasonData={seasonData}
          currentSeason={seasonNumber}
          currentEpisode={episodeNumber}
          onSeasonChange={handleSeasonChange}
          onEpisodeSelect={(ep) => {
            handleEpisodeChange(ep);
            setShowEpisodeOverlay(false);
          }}
          id={id}
        />
      )}
      
      {/* Details & Episode Selection Area */}`
);

// We should hide the bottom section if provider is active
content = content.replace(
  "{showBottomSection && (",
  "{showBottomSection && !isProviderActive && ("
);

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('updated src/pages/WatchPage.tsx');
