const fs = require('fs');
let code = fs.readFileSync('src/api/anilist.ts', 'utf-8');

// Reduce the AniList queue delay from 750ms to 50ms (or remove it)
code = code.replace(/await sleep\(750\);/g, 'await sleep(50);');

fs.writeFileSync('src/api/anilist.ts', code);
