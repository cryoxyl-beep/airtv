const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

code = code.replace(
  "delayMs += 150; // stagger requests by 150ms",
  "delayMs += 300; // stagger requests by 300ms to avoid rate limits and connection drops"
);

fs.writeFileSync('src/pages/Home.tsx', code);
