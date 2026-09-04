const fs = require('fs');

// 1. Fix Home.tsx
let home = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
home = home.replace('gap-10', 'gap-4');
fs.writeFileSync('src/pages/Home.tsx', home);

// 2. Fix Row.tsx
let row = fs.readFileSync('src/components/Row.tsx', 'utf-8');
row = row.replace('className="relative mb-8 group/row"', 'className="relative group/row"');
row = row.replace("isTop10 ? 'gap-8 py-4' : 'gap-4 py-8'", "isTop10 ? 'gap-8 py-4' : 'gap-4 py-4'");
fs.writeFileSync('src/components/Row.tsx', row);

// 3. Fix PlatformRow.tsx
let platform = fs.readFileSync('src/components/PlatformRow.tsx', 'utf-8');
platform = platform.replace('className="relative mb-8 group/row"', 'className="relative group/row"');
platform = platform.replace('gap-6 py-8', 'gap-6 py-4');
fs.writeFileSync('src/components/PlatformRow.tsx', platform);

