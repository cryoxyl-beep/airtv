const fs = require('fs');
let content = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

content = content.replace(/const isImmersive = location\.pathname\.startsWith\('\/watch\/'\);/, 
  "const isImmersive = location.pathname.startsWith('/watch/') || location.pathname.startsWith('/anime/');");

fs.writeFileSync('src/components/Navbar.tsx', content, 'utf8');
