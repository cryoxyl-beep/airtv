const fs = require('fs');
let content = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');

content = content.replace(
  "<RowCard item={item} index={index} />",
  "<RowCard item={item} index={index} isGridCard={true} />"
);

fs.writeFileSync('src/pages/SearchPage.tsx', content, 'utf8');
