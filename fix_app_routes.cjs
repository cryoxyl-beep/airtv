const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  "import Home from './pages/Home';",
  "import Landing from './pages/Landing';\nimport Home from './pages/Home';"
);

code = code.replace(
  '<Route path="/" element={<Home />} />',
  '<Route path="/" element={<Landing />} />\n        <Route path="/home" element={<Home />} />'
);

code = code.replace(
  '<Navigate to="/" replace />',
  '<Navigate to="/home" replace />'
);

fs.writeFileSync('src/App.tsx', code);
