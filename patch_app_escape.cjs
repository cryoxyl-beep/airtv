const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "navigate(-1); // go back",
  "if (window.history.length > 1) { navigate(-1); } else { navigate('/'); }"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
