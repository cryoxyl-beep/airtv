const fs = require('fs');

let content = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');

// Stop trailer when isProviderActive is true
content = content.replace(
  "{trailerKey && !trailerEnded && (",
  "{trailerKey && !trailerEnded && !isProviderActive && ("
);

// Add key to iframe to force remount
content = content.replace(
  "<iframe\n            src={providerIframeUrl}",
  "<iframe\n            key={providerIframeUrl || 'provider'}\n            src={providerIframeUrl}"
);

fs.writeFileSync('src/components/WatchPage.tsx', content);
console.log('Fixed WatchPage trailer and iframe key');
