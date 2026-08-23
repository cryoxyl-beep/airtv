const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

const targetStr = '<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] md:w-[180%] lg:w-[150%] aspect-video pointer-events-none">';
const newStr = '<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] md:w-[180%] aspect-video pointer-events-none">';

code = code.replace(targetStr, newStr);
fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
