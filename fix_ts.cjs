const fs = require('fs');
let content = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');

// Add onToggleEpisodes to WatchPageProps if missing
if (!content.includes('onToggleEpisodes?: () => void;')) {
  content = content.replace(
    "providerIframeUrl?: string | null;\n  item: any;",
    "providerIframeUrl?: string | null;\n  onToggleEpisodes?: () => void;\n  item: any;"
  );
}

// Add ListVideo import if missing
if (!content.includes('ListVideo')) {
  content = content.replace(
    "import { Play, Volume2, VolumeX, ArrowLeft, Maximize2 } from 'lucide-react';",
    "import { Play, Volume2, VolumeX, ArrowLeft, Maximize2, ListVideo } from 'lucide-react';"
  );
}

fs.writeFileSync('src/components/WatchPage.tsx', content);
