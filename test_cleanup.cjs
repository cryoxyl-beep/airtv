const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

if (!code.includes('cutoffTimerRef.current)')) {
  code = code.replace(
    /clearTimeout\(playerInitTimer\);/,
    'clearTimeout(playerInitTimer);\n      if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);'
  );
  fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
}
