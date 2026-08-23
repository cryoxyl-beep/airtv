const fs = require('fs');
let content = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

content = content.replace(
  "if (window.scrollY > window.innerHeight * 0.9) {",
  "if (window.scrollY > 0) {"
);

fs.writeFileSync('src/components/Navbar.tsx', content, 'utf8');
