const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

// The SafeFetch logic is doing delayMs += 300; let's increase the stagger
code = code.replace('delayMs += 300', 'delayMs += 500');

fs.writeFileSync('src/pages/Home.tsx', code);
