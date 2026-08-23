const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/pages/WatchPage.tsx', 'utf8');

const targetNav = `<div className="absolute top-0 left-0 w-full p-6 z-50 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent">`;
const newNav = `<div className="absolute top-0 left-0 p-6 z-50 flex items-center gap-4">`;

code = code.replace(targetNav, newNav);
fs.writeFileSync('/app/applet/src/pages/WatchPage.tsx', code);
