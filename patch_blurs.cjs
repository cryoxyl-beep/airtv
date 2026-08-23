const fs = require('fs');

const removeBlur = (file) => {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/bg-black\/40\s+hover:bg-white\/10\s+rounded-full\s+backdrop-blur-md/g, 'hover:bg-white/10 rounded-full');
  fs.writeFileSync(file, code);
  console.log(`Patched ${file}`);
}

removeBlur('/app/applet/src/pages/WatchPage.tsx');
removeBlur('/app/applet/src/pages/BrowsePage.tsx');
