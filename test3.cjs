const fs = require('fs');
let c = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');
c = c.replace(
  "let providerUrl: string | null = null; console.log('RENDER WatchPage:', {seasonNumber, episodeNumber});",
  "let providerUrl: string | null = null;\n"
);
c = c.replace(
  "return (",
  "useEffect(() => { console.log('PROVIDER URL CHANGED:', providerUrl); }, [providerUrl]);\n  return ("
);
fs.writeFileSync('src/pages/WatchPage.tsx', c);
