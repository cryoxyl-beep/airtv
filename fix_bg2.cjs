const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');
code = code.replace(/bg-black/g, "bg-[#0b0b0b]");
fs.writeFileSync('src/pages/WatchPage.tsx', code);
