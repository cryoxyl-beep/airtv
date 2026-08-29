const fs = require('fs');
let code = fs.readFileSync('src/components/EpisodeList.tsx', 'utf-8');
code = code.replace(/hover:scale-\[1\.03\]/, 'hover:scale-110');
fs.writeFileSync('src/components/EpisodeList.tsx', code);
