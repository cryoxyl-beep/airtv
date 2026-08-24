const fs = require('fs');

let code = fs.readFileSync('/app/applet/src/hooks/useScrollRestoration.ts', 'utf8');
code = code.replace(/requestAnimationFrame\(\(\) => \{\n\s*window\.scrollTo\(0, y\);\n\s*\}\);/g, "window.scrollTo(0, y);");
fs.writeFileSync('/app/applet/src/hooks/useScrollRestoration.ts', code);
