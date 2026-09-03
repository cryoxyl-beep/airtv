const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

code = code.replace(
  "const isImmersive = location.pathname.startsWith('/watch/') || location.pathname.startsWith('/anime/') || location.pathname.startsWith('/play/');",
  "const isImmersive = location.pathname === '/' || location.pathname.startsWith('/watch/') || location.pathname.startsWith('/anime/') || location.pathname.startsWith('/play/');"
);

code = code.replace(
  "{(location.pathname === '/' || location.pathname === '/search') && (",
  "{(location.pathname === '/home' || location.pathname === '/search') && ("
);

code = code.replace(
  "if (location.pathname === '/') {",
  "if (location.pathname === '/home') {"
);

code = code.replace(
  "navigate('/');",
  "navigate('/home');"
);

fs.writeFileSync('src/components/Navbar.tsx', code);
