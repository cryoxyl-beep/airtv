const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

const target1 = `        const filteredTop10 = (top10Data.results || []).filter((item: any) => {
          const title = item.title || item.name || '';
          return title !== 'Tagesschau' && title !== 'Paradise Hotel';
        }).slice(0, 10);`;

const replacement1 = `        const filteredTop10 = (top10Data.results || []).filter((item: any) => {
          const title = item.title || item.name || '';
          return title !== 'Tagesschau' && title !== 'Paradise Hotel';
        });`;

code = code.replace(target1, replacement1);

const target2 = `          top10: filteredTop10,`;
const replacement2 = `          top10: mix(filteredTop10, trendingAnimeData.results || []).slice(0, 10),`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/pages/Home.tsx', code);
