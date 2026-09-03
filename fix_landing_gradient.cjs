const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

code = code.replace(
  "from-transparent via-black/40 to-black",
  "from-transparent via-black/80 to-black"
);

fs.writeFileSync('src/pages/Landing.tsx', code);
