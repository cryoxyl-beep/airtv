const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/pages/WatchPage.tsx', 'utf8');
code = code.replace(/w-full p-6 z-50 flex items-center gap-4 bg-gradient-to-b from-black\/80 to-transparent/g, 'p-6 z-50 flex items-center gap-4');
fs.writeFileSync('/app/applet/src/pages/WatchPage.tsx', code);
console.log("Patched WatchPage");
