const fs = require('fs');

let page = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');
page = page.replace('pb-10 pt-2 md:pt-4', 'pb-10');
page = page.replace('className="mt-2"', 'className="mt-0"');
fs.writeFileSync('src/pages/WatchPage.tsx', page);
