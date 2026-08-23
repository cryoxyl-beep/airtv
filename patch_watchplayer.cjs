const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

const targetGrad = "linear-gradient(to top, rgba(11,11,11,0.9) 0%";
const newGrad = "linear-gradient(to top, rgba(11,11,11,1) 0%";

code = code.replace(targetGrad, newGrad);
fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
