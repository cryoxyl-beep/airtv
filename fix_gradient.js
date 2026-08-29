const fs = require('fs');
let code = fs.readFileSync('src/components/WatchPage.tsx', 'utf-8');
code = code.replace(
  "linear-gradient(to top, #0b0b0b 0px, transparent 150px)",
  "linear-gradient(to top, #0b0b0b 0px, rgba(11,11,11,0.98) 30px, rgba(11,11,11,0.85) 100px, rgba(11,11,11,0.4) 200px, transparent 300px)"
);
fs.writeFileSync('src/components/WatchPage.tsx', code);
