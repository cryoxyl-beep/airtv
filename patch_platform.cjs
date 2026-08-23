const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/PlatformRow.tsx', 'utf8');
code = code.replace(
  /<span className="text-white\/60 text-xs font-medium tracking-wide group-hover:text-white transition-colors text-center w-full leading-tight">\s*\{platform\.name\}\s*<\/span>/,
  ''
);
fs.writeFileSync('/app/applet/src/components/PlatformRow.tsx', code);
