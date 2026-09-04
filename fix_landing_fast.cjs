const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

code = code.replace(
  'fetchTrendingAnime(20),',
  'fetchTrendingAnime(20, true),'
);

fs.writeFileSync('src/pages/Landing.tsx', code);
