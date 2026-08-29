const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// replace watch/tv/:id with both
app = app.replace(
  '<Route path="/watch/tv/:id" element={<WatchPage type="tv" />} />',
  '<Route path="/watch/tv/:id" element={<WatchPage type="tv" />} />\n        <Route path="/watch/tv/:id/:season/:episode" element={<WatchPage type="tv" />} />'
);

// replace anime/:id with both
app = app.replace(
  '<Route path="/anime/:id" element={<WatchPage type="anime" />} />',
  '<Route path="/anime/:id" element={<WatchPage type="anime" />} />\n        <Route path="/anime/:id/:episode" element={<WatchPage type="anime" />} />'
);

fs.writeFileSync('src/App.tsx', app);
console.log('App routes updated');
