const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

code = code.replace(/const loadSeason = async \(\) => \{\s*const season = await fetchTVSeason/g, 
  "const loadSeason = async () => { try { const season = await fetchTVSeason");

fs.writeFileSync('src/pages/WatchPage.tsx', code);
