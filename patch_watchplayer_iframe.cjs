const fs = require('fs');
let content = fs.readFileSync('src/components/WatchPlayer.tsx', 'utf8');

content = content.replace(
  "mute=0",
  "mute=${isMuted ? 1 : 0}"
);

fs.writeFileSync('src/components/WatchPlayer.tsx', content, 'utf8');
