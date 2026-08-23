const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

// Add cutoffTimerRef
if (!code.includes('cutoffTimerRef')) {
  code = code.replace(
    'const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);',
    'const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const cutoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);'
  );
}

// Add onReady handler
const onReadyCode = `onReady: (event: any) => {
              const duration = event.target.getDuration();
              const CUTOFF_BUFFER = 10;
              const cutoffDelay = Math.max(0, (duration - CUTOFF_BUFFER)) * 1000;
              
              if (duration > CUTOFF_BUFFER) {
                cutoffTimerRef.current = setTimeout(() => {
                  event.target.stopVideo();
                  setTrailerEnded(true);
                  setTrailerPlaying(false);
                  setIsUiHidden(false);
                  isPlayingRef.current = false;
                }, cutoffDelay);
              }
            },
            onStateChange: (event: any) => {`;

if (!code.includes('onReady: (event: any) => {')) {
  code = code.replace('onStateChange: (event: any) => {', onReadyCode);
}

// Update cleanup
if (!code.includes('cutoffTimerRef.current')) {
  code = code.replace(
    'clearTimeout(playerInitTimer);',
    'clearTimeout(playerInitTimer);\n      if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);'
  );
}

fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
