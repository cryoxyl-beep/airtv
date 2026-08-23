const fs = require('fs');

function fixImageUrl(content) {
  content = content.replace(/\`\$\{IMAGE_BASE_URL\}\$\{([^}]+)\}\`/g, "($1?.startsWith('http') ? $1 : \`\${IMAGE_BASE_URL}\${$1}\`)");
  content = content.replace(/\`\$\{IMAGE_BASE_URL_W500\}\$\{([^}]+)\}\`/g, "($1?.startsWith('http') ? $1 : \`\${IMAGE_BASE_URL_W500}\${$1}\`)");
  return content;
}

['src/components/Hero.tsx', 'src/components/Row.tsx', 'src/components/WatchPlayer.tsx', 'src/components/EpisodeList.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = fixImageUrl(content);
  fs.writeFileSync(file, content, 'utf8');
});

console.log('Patched image URLs in components');
