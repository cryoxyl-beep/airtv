const fs = require('fs');
let content = fs.readFileSync('src/components/WatchPlayer.tsx', 'utf8');

content = content.replace(
  "const [isMuted, setIsMuted] = useState(getVideoMutedPreference());",
  "const [isMuted, setIsMuted] = useState(getVideoMutedPreference());\n  const [initialMuted] = useState(isMuted);"
);

content = content.replace(
  "mute=${isMuted ? 1 : 0}",
  "mute=${initialMuted ? 1 : 0}"
);

fs.writeFileSync('src/components/WatchPlayer.tsx', content, 'utf8');
