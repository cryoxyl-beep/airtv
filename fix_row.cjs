const fs = require('fs');
let code = fs.readFileSync('src/components/Row.tsx', 'utf-8');

code = code.replace(
  "export const RowCard: React.FC<{ item: any; isTop10?: boolean; index: number; isGridCard?: boolean }> = ({ item, isTop10 = false, index, isGridCard = false }) => {",
  "export const RowCard: React.FC<{ item: any; isTop10?: boolean; index: number; isGridCard?: boolean; hideTitleWithLogo?: boolean }> = ({ item, isTop10 = false, index, isGridCard = false, hideTitleWithLogo = false }) => {"
);

code = code.replace(
  "{item.source === 'anilist' && (",
  "{item.source === 'anilist' && !hideTitleWithLogo && ("
);

code = code.replace(
  "<RowCard key={item.id} item={item} isTop10={isTop10} index={index} />",
  "<RowCard key={item.id} item={item} isTop10={isTop10} index={index} hideTitleWithLogo={true} />"
);

fs.writeFileSync('src/components/Row.tsx', code);
