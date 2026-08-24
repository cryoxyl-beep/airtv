const fs = require('fs');
let content = fs.readFileSync('src/components/Row.tsx', 'utf8');

content = content.replace(
  "export const RowCard: React.FC<{ item: any; isTop10?: boolean; index: number }> = ({ item, isTop10 = false, index }) => {",
  "export const RowCard: React.FC<{ item: any; isTop10?: boolean; index: number; isGridCard?: boolean }> = ({ item, isTop10 = false, index, isGridCard = false }) => {"
);

content = content.replace(
  "        isTop10 ? 'gap-2 md:gap-4' : 'w-[300px] md:w-[400px] lg:w-[450px]'",
  "        isTop10 ? 'gap-2 md:gap-4' : isGridCard ? 'w-full' : 'w-[300px] md:w-[400px] lg:w-[450px]'"
);

fs.writeFileSync('src/components/Row.tsx', content, 'utf8');
