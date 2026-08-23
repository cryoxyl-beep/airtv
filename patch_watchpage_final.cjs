const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const target = "                    if (exists) {\n                       navigate(`/anime/${prefId}`, { replace: true });\n                       return;\n                    }";

const replacement = "                    if (exists) {\n                       isRedirecting = true;\n                       navigate(`/anime/${prefId}`, { replace: true });\n                       return;\n                    }";

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
