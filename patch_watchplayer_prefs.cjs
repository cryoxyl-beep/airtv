const fs = require('fs');
let content = fs.readFileSync('src/components/WatchPlayer.tsx', 'utf8');

// Inject import
if (!content.includes('getVideoMutedPreference')) {
  content = content.replace(
    "import { Play, ThumbsUp, ThumbsDown, Volume2, VolumeX } from 'lucide-react';",
    "import { Play, ThumbsUp, ThumbsDown, Volume2, VolumeX } from 'lucide-react';\nimport { getVideoMutedPreference, setVideoMutedPreference } from '../utils/preferences';"
  );
  
  // Replace initial state
  content = content.replace(
    "const [isMuted, setIsMuted] = useState(false);",
    "const [isMuted, setIsMuted] = useState(getVideoMutedPreference());"
  );
  
  // Replace toggleMute
  const targetToggleMute = `  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    iframeRef.current?.contentWindow?.postMessage(`;
    
  const replacementToggleMute = `  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setVideoMutedPreference(nextMuted);
    iframeRef.current?.contentWindow?.postMessage(`;
    
  content = content.replace(targetToggleMute, replacementToggleMute);
  
  // Ensure the trailer iframe ALSO plays muted if the preference is true!
  // Wait, let's see how the iframe URL is constructed.
}

fs.writeFileSync('src/components/WatchPlayer.tsx', content, 'utf8');
