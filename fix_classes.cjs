const fs = require('fs');

let page = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');
page = page.replace(/bg-\\\[#0b0b0b\\\]/g, 'bg-[#0b0b0b]');
fs.writeFileSync('src/pages/WatchPage.tsx', page);

let comp = fs.readFileSync('src/components/WatchPage.tsx', 'utf-8');
comp = comp.replace(/bg-\\\[#0b0b0b\\\]/g, 'bg-[#0b0b0b]');
fs.writeFileSync('src/components/WatchPage.tsx', comp);

