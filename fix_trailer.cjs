const fs = require('fs');
let content = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');

const effectCode = `
  useEffect(() => {
    if (isProviderActive) {
      setTrailerEnded(true);
      setTrailerPlaying(false);
      isPlayingRef.current = false;
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      }
    }
  }, [isProviderActive]);
`;

content = content.replace(
  "const handleMouseMove = () => {",
  effectCode + "\n  const handleMouseMove = () => {"
);

fs.writeFileSync('src/components/WatchPage.tsx', content);
console.log('fixed trailer issue');
