const fs = require('fs');

let appCode = fs.readFileSync('/app/applet/src/App.tsx', 'utf8');

if (!appCode.includes("import Navbar")) {
  appCode = appCode.replace(
    "import { useScrollRestoration } from './hooks/useScrollRestoration';",
    "import { useScrollRestoration } from './hooks/useScrollRestoration';\nimport Navbar from './components/Navbar';"
  );
  
  appCode = appCode.replace(
    "<ScrollManager />",
    "<ScrollManager />\n      <Navbar />"
  );
  
  fs.writeFileSync('/app/applet/src/App.tsx', appCode);
  console.log("Patched App.tsx");
}

