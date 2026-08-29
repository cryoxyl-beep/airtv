const fs = require('fs');
let code = fs.readFileSync('src/components/EpisodeOverlay.tsx', 'utf-8');

// 1. Remove SeasonSelector entirely
code = code.replace(/\{type === 'tv' && data\.seasons && \([\s\S]*?\}\)/, '');
code = code.replace(/\{type === 'anime' && data\.animeGroup\?\.seasons && data\.animeGroup\.seasons\.length > 0 && \([\s\S]*?\}\)/, '');
code = code.replace(/import SeasonSelector from '\.\/SeasonSelector';\n/, '');

// 2. Fix the overlapping issue (remove scale-110 from root div, change gap-4 to gap-6)
code = code.replace(
  /className="flex gap-4 overflow-x-auto/g, 
  'className="flex gap-6 overflow-x-auto'
);

code = code.replace(
  /\$\{isActive \? 'scale-110' : 'hover:scale-110'\}/g,
  "${isActive ? '' : ''}"
);

fs.writeFileSync('src/components/EpisodeOverlay.tsx', code);
