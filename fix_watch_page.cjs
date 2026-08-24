const fs = require('fs');

let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

// Do not hide bottom section when isProviderActive
content = content.replace(
  "{showBottomSection && !isProviderActive && (",
  "{showBottomSection && ("
);

// Do not force full screen when isProviderActive
content = content.replace(
  "forceFullScreen={!showBottomSection || isProviderActive}",
  "forceFullScreen={!showBottomSection}"
);

fs.writeFileSync('src/pages/WatchPage.tsx', content);
console.log('fixed src/pages/WatchPage.tsx');
