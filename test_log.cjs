const fs = require('fs');
let c = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');
c = c.replace("let providerUrl: string | null = null;", "let providerUrl: string | null = null; console.log('RENDER WatchPage:', {seasonNumber, episodeNumber});");
fs.writeFileSync('src/pages/WatchPage.tsx', c);
