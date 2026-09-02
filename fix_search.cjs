const fs = require('fs');
let code = fs.readFileSync('src/pages/SearchPage.tsx', 'utf-8');

code = code.replace(
  "type FilterType = 'all' | 'movies' | 'series' | 'anime';",
  "type FilterType = '' | 'all' | 'movies' | 'series' | 'anime';"
);

fs.writeFileSync('src/pages/SearchPage.tsx', code);
