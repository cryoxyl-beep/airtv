const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

code = code.replace(
  /className=\{`transition-opacity duration-500 \$\{isUiHidden \? 'opacity-0' : 'opacity-100'\}`\}/g,
  'className="transition-opacity duration-500"'
);

code = code.replace(
  /className=\{`flex items-center gap-3 transition-opacity duration-500 \$\{isUiHidden \? 'opacity-0 pointer-events-none' : 'opacity-100'\}`\}/g,
  'className="flex items-center gap-3"'
);

code = code.replace(
  /className=\{`flex flex-col md:items-end md:text-right gap-2 md:gap-3 md:w-7\/12 lg:w-1\/2 md:pb-2 pointer-events-none transition-opacity duration-500 \$\{isUiHidden \? 'opacity-0' : 'opacity-100'\}`\}/g,
  'className="flex flex-col md:items-end md:text-right gap-2 md:gap-3 md:w-7/12 lg:w-1/2 md:pb-2 pointer-events-none"'
);

fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
console.log("Patched UI hiding");
