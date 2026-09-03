const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

code = code.replace(
  "src={`\\${IMAGE_BASE_URL_W500}\\${poster.poster_path}`}",
  "src={poster.poster_path.startsWith('http') ? poster.poster_path : `\\${IMAGE_BASE_URL_W500}\\${poster.poster_path}`}"
);

fs.writeFileSync('src/pages/Landing.tsx', code);
