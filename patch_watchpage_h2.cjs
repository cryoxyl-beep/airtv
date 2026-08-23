const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

content = content.replace(
  '<h2 className="text-white/60 text-sm font-semibold uppercase tracking-wider">{data.animeGroup.title}</h2>',
  ''
);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
