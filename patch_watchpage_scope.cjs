const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

content = content.replace(
  "      let isRedirecting = false;\n      try {",
  "      try {"
);

content = content.replace(
  "    const loadContent = async () => {\n      setLoading(true);\n      setError(false);",
  "    const loadContent = async () => {\n      setLoading(true);\n      setError(false);\n      let isRedirecting = false;"
);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
