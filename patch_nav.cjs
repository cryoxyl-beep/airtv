const fs = require('fs');

function patchNavigation(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const replacer = (match, itemRef) => {
    return `
        if (${itemRef}.source === 'anilist') {
          navigate(\`/anime/\${${itemRef}.id}\`);
        } else {
          const type = ${itemRef}.media_type || (${itemRef}.first_air_date ? 'tv' : 'movie');
          if (type === 'tv') {
            navigate(\`/watch/tv/\${${itemRef}.id}\`);
          } else {
            navigate(\`/watch/movie/\${${itemRef}.id}\`);
          }
        }
    `;
  };

  // For Hero.tsx (uses activeItem)
  if (filePath.includes('Hero.tsx')) {
    content = content.replace(/const type = activeItem\.media_type \|\| \(activeItem\.first_air_date \? 'tv' : 'movie'\);\s*if \(type === 'tv'\) {\s*navigate\(\`\/watch\/tv\/\$\{activeItem\.id\}\`\);\s*} else {\s*navigate\(\`\/watch\/movie\/\$\{activeItem\.id\}\`\);\s*}/, 
      `if (activeItem.source === 'anilist') {
          navigate(\`/anime/\${activeItem.id}\`);
        } else {
          const type = activeItem.media_type || (activeItem.first_air_date ? 'tv' : 'movie');
          if (type === 'tv') {
            navigate(\`/watch/tv/\${activeItem.id}\`);
          } else {
            navigate(\`/watch/movie/\${activeItem.id}\`);
          }
        }`);
  }

  // For Row.tsx and BrowsePage.tsx (uses item)
  if (filePath.includes('Row.tsx') || filePath.includes('BrowsePage.tsx') || filePath.includes('SearchPage.tsx') || filePath.includes('SearchResults.tsx')) {
    content = content.replace(/const type = item\.media_type \|\| \(item\.first_air_date \? 'tv' : 'movie'\);\s*if \(type === 'tv'\) {\s*navigate\(\`\/watch\/tv\/\$\{item\.id\}\`\);\s*} else {\s*navigate\(\`\/watch\/movie\/\$\{item\.id\}\`\);\s*}/g, 
      `if (item.source === 'anilist') {
          navigate(\`/anime/\${item.id}\`);
        } else {
          const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
          if (type === 'tv') {
            navigate(\`/watch/tv/\${item.id}\`);
          } else {
            navigate(\`/watch/movie/\${item.id}\`);
          }
        }`);
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}

['src/components/Hero.tsx', 'src/components/Row.tsx', 'src/pages/BrowsePage.tsx'].forEach(file => {
  if (fs.existsSync(file)) patchNavigation(file);
});
console.log('patched navigation');
