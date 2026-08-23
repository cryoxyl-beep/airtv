const fs = require('fs');

const buttonClass = 'w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group';

// Patch WatchPage
let watchCode = fs.readFileSync('/app/applet/src/pages/WatchPage.tsx', 'utf8');
watchCode = watchCode.replace(
  'className="p-3 hover:bg-white/10 rounded-full transition-all group"',
  `className="${buttonClass}"`
);
fs.writeFileSync('/app/applet/src/pages/WatchPage.tsx', watchCode);

// Patch BrowsePage
let browseCode = fs.readFileSync('/app/applet/src/pages/BrowsePage.tsx', 'utf8');
browseCode = browseCode.replace(
  'className="p-3 hover:bg-white/10 rounded-full transition-all group"',
  `className="${buttonClass}"`
);
fs.writeFileSync('/app/applet/src/pages/BrowsePage.tsx', browseCode);

// Patch WatchPlayer
let playerCode = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');
playerCode = playerCode.replace(
  'className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-xl"',
  `className="${buttonClass}"`
);
fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', playerCode);

console.log("Patched all buttons");
