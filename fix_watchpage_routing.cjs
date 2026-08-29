const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

// 1. Add season and episode to useParams
content = content.replace(
  "const { id } = useParams();",
  "const { id, season, episode } = useParams();"
);

// 2. Initialize state from params
content = content.replace(
  "const [seasonNumber, setSeasonNumber] = useState(1);",
  "const [seasonNumber, setSeasonNumber] = useState(season ? parseInt(season, 10) : 1);"
);

content = content.replace(
  "const [episodeNumber, setEpisodeNumber] = useState(1);",
  "const [episodeNumber, setEpisodeNumber] = useState(episode ? parseInt(episode, 10) : 1);"
);

// 3. Add useEffect to sync state from params
const syncEffect = `
  useEffect(() => {
    if (season) setSeasonNumber(parseInt(season, 10));
    if (episode) setEpisodeNumber(parseInt(episode, 10));
  }, [season, episode]);
`;

content = content.replace(
  "const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);",
  "const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);\n" + syncEffect
);

// 4. Update handlers to navigate
const oldSeasonHandler = `const handleSeasonChange = (newSeason: number) => {
    setSeasonNumber(newSeason);
    setEpisodeNumber(1);
  };`;

const newSeasonHandler = `const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(\`/watch/tv/\${id}/\${newSeason}/1\`, { replace: false });
    } else {
      setSeasonNumber(newSeason);
      setEpisodeNumber(1);
    }
  };`;

content = content.replace(oldSeasonHandler, newSeasonHandler);

const oldEpisodeHandler = `const handleEpisodeChange = (newEpisode: number) => {
    setEpisodeNumber(newEpisode);
  };`;

const newEpisodeHandler = `const handleEpisodeChange = (newEpisode: number) => {
    if (type === 'tv') {
      navigate(\`/watch/tv/\${id}/\${seasonNumber}/\${newEpisode}\`, { replace: false });
    } else if (type === 'anime') {
      navigate(\`/anime/\${id}/\${newEpisode}\`, { replace: false });
    } else {
      setEpisodeNumber(newEpisode);
    }
  };`;

content = content.replace(oldEpisodeHandler, newEpisodeHandler);

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('Fixed WatchPage routing');
