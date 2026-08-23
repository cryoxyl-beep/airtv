const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

// Remove max-w-7xl mx-auto
code = code.replace(
  'className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-12 w-full max-w-7xl mx-auto h-full pointer-events-none"',
  'className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-12 w-full h-full pointer-events-none"'
);

// Add alignment to Right Side
code = code.replace(
  '          {/* Right Side: Metadata & Description */}\n          <div className={`flex flex-col gap-2 md:gap-3 md:w-7/12 lg:w-1/2 md:pb-2 pointer-events-none transition-opacity duration-500 ${isUiHidden ? \'opacity-0\' : \'opacity-100\'}`}>',
  '          {/* Right Side: Metadata & Description */}\n          <div className={`flex flex-col md:items-end md:text-right gap-2 md:gap-3 md:w-7/12 lg:w-1/2 md:pb-2 pointer-events-none transition-opacity duration-500 ${isUiHidden ? \'opacity-0\' : \'opacity-100\'}`}>'
);

code = code.replace(
  '<div className="flex flex-wrap items-center gap-3 text-xs md:text-sm lg:text-base text-white/70 font-medium drop-shadow-md">',
  '<div className="flex flex-wrap items-center md:justify-end gap-3 text-xs md:text-sm lg:text-base text-white/70 font-medium drop-shadow-md">'
);

fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
console.log("Patched WatchPlayer Layout");
