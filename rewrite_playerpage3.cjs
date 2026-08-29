const fs = require('fs');
let code = fs.readFileSync('src/pages/PlayerPage.tsx', 'utf-8');

const target = `const malId = data.mal_id || data.idmal || data.id_mal;`;
const replacement = `const malId = data.fribb_mapping?.malId || data.mal_id || data.idmal || data.id_mal;`;
code = code.replace(target, replacement);

fs.writeFileSync('src/pages/PlayerPage.tsx', code);
