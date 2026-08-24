const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

// I'll just change safeFetch to take () => Promise<any> for EVERYTHING, and wrap all of them
content = content.replace(
  "safeFetch(fetchTrending()),",
  "safeFetch(() => fetchTrending()),"
);
content = content.replace(
  "safeFetch(fetchTop10()),",
  "safeFetch(() => fetchTop10()),"
);

// Ah, wait! The regex I used earlier probably didn't match the lines exactly. Let me just use a regex over the whole block.
const regex = /safeFetch\((fetch[a-zA-Z0-9_]+\([^)]*\))\)/g;
content = content.replace(regex, "safeFetch(() => $1)");

fs.writeFileSync('src/pages/Home.tsx', content, 'utf8');
