const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

// 1. Add IFrame API script injection
const iframeApiCode = `
  useEffect(() => {
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);
`;

if (!code.includes('youtube-iframe-api')) {
  code = code.replace(
    /useEffect\(\(\) => \{\n\s*let mounted = true;/,
    iframeApiCode + '\n  useEffect(() => {\n    let mounted = true;'
  );
}

// 2. Add YT.Player initialization
const ytPlayerCode = `
    let playerInitTimer: ReturnType<typeof setTimeout>;

    const initPlayer = () => {
      const yt = (window as any).YT;
      if (yt && yt.Player && iframeRef.current) {
        new yt.Player(iframeRef.current, {
          events: {
            onStateChange: (event: any) => {
              if (event.data === 1) {
                setTrailerPlaying(true);
                isPlayingRef.current = true;
              } else if (event.data === 0) {
                setTrailerEnded(true);
                setTrailerPlaying(false);
                setIsUiHidden(false);
                isPlayingRef.current = false;
              }
            }
          }
        });
      } else {
        playerInitTimer = setTimeout(initPlayer, 100);
      }
    };

    initPlayer();`;

if (!code.includes('playerInitTimer')) {
  // insert before the handleMessage return statement
  code = code.replace(
    /return \(\) => \{\n\s*window.removeEventListener\('message', handleMessage\);\n\s*\};\n\s*\}, \[trailerKey\]\);/m,
    `
${ytPlayerCode}

    return () => {
      clearTimeout(playerInitTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, [trailerKey]);`
  );
}

fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
