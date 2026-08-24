const fs = require('fs');

function processFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('useLayoutEffect')) {
    code = code.replace(/import React, \{ (.*?) \} from 'react';/, "import React, { $1, useLayoutEffect } from 'react';");
  }
  
  // Replace the specific useEffect for restoring scroll
  code = code.replace(/useEffect\(\(\) => \{\n    if \(navigationType === 'POP'/, "useLayoutEffect(() => {\n    if (navigationType === 'POP'");
  
  fs.writeFileSync(file, code);
}

processFile('/app/applet/src/components/Row.tsx');
processFile('/app/applet/src/components/PlatformRow.tsx');
