const fs = require('fs');

let content = fs.readFileSync('src/components/EpisodeOverlay.tsx', 'utf8');

// Add onClose prop
content = content.replace(
  "id: string | undefined;\n}",
  "id: string | undefined;\n  onClose?: () => void;\n}"
);

content = content.replace(
  "onEpisodeSelect, id }: EpisodeOverlayProps)",
  "onEpisodeSelect, id, onClose }: EpisodeOverlayProps)"
);

// Add Close button
content = content.replace(
  '<div className="w-full max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col gap-4">',
  '<div className="w-full max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col gap-4">\n        {onClose && (\n          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50">\n            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>\n          </button>\n        )}'
);

fs.writeFileSync('src/components/EpisodeOverlay.tsx', content);

let pageContent = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');
pageContent = pageContent.replace(
  "id={id}\n        />",
  "id={id}\n          onClose={() => setShowEpisodeOverlay(false)}\n        />"
);
fs.writeFileSync('src/pages/WatchPage.tsx', pageContent);

