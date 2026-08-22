const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/requestAnimationFrame\(\(\) => \{\n\s*if \(rowRef\.current\) \{\n\s*rowRef\.current\.scrollLeft = x;\n\s*\}\n\s*\}\);/g, "if (rowRef.current) { rowRef.current.scrollLeft = x; }");
  fs.writeFileSync(file, code);
}

fix('/app/applet/src/components/Row.tsx');
fix('/app/applet/src/components/PlatformRow.tsx');
