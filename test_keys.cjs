const fs = require('fs');
let c = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');

c = c.replace(
  "key={providerIframeUrl || 'provider'}",
  "key={`iframe-${providerIframeUrl || 'provider'}`}"
);

fs.writeFileSync('src/components/WatchPage.tsx', c);
console.log('Updated key');
