const fs = require('fs');
let content = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');

content = content.replace("className={\\`px-6", "className={`px-6");
content = content.replace("transition-all \\${", "transition-all ${");
content = content.replace("hover:bg-white/10'\\n      }\\`}", "hover:bg-white/10'\n      }`}");

fs.writeFileSync('src/pages/SearchPage.tsx', content, 'utf8');
