const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const regex = /still_path: tmdbEp\?\.still_path \|\| null/g;
const replacement = `still_path: tmdbEp?.still_path || ep.still_path`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
