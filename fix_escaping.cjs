const fs = require('fs');
let code = fs.readFileSync('src/api/animeRelations.ts', 'utf-8');
code = code.replace(/\\`Related \(\\\$\\{edge.relationType\\}\\)\\`/g, "\`Related (\${edge.relationType})\`");
fs.writeFileSync('src/api/animeRelations.ts', code);
