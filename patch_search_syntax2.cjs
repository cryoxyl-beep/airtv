const fs = require('fs');
let content = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');

content = content.replace(
  "      }\\`}",
  "      }`}"
);

fs.writeFileSync('src/pages/SearchPage.tsx', content, 'utf8');
