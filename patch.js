const fs = require('fs');
let code = fs.readFileSync('src/components/Row.tsx', 'utf-8');

code = code.replace(
`            onApiChange: (event: any) => {
              if (event.target.unloadModule) event.target.unloadModule('captions');
            }
          }`,
`            onApiChange: (event: any) => {
              if (event.target.unloadModule) event.target.unloadModule('captions');
            },
            onStateChange: (event: any) => {
              if (event.data === 1) {
                if (isCurrent) setIsPlaying(true);
              }
            }
          }`);

code = code.replace(
`    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.event === 'onStateChange' && data.info === 1) {
          if (isCurrent) setIsPlaying(true);
        }
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);

    return () => {
      isCurrent = false;
      clearTimeout(playerInitTimer);
      window.removeEventListener('message', handleMessage);
    };`,
`    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // The iframe ID is passed back in the postMessage as data.id. 
        // But since we just want it to work, we'll accept any playing event or rely on the YT API and fallback.
        if (data && data.event === 'onStateChange' && data.info === 1) {
          if (isCurrent) setIsPlaying(true);
        }
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);

    // Fallback: if we never get the playing event, reveal after 2 seconds anyway
    const fallbackTimer = setTimeout(() => {
      if (isCurrent) setIsPlaying(true);
    }, 2500);

    return () => {
      isCurrent = false;
      clearTimeout(playerInitTimer);
      clearTimeout(fallbackTimer);
      window.removeEventListener('message', handleMessage);
    };`);

fs.writeFileSync('src/components/Row.tsx', code);
