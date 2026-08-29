const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('#0b0b0b') || content.includes('bg-[#0b0b0b]')) {
        content = content.replace(/bg-\[#0b0b0b\]/g, 'bg-black');
        content = content.replace(/\[#0b0b0b\]/g, 'black');
        content = content.replace(/#0b0b0b/g, '#000000');
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

replaceInDir('src');
