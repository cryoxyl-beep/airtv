const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');
code = code.replace('const CUTOFF_BUFFER = 10;', 'const CUTOFF_BUFFER = 15;');
fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
