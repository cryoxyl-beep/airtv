const fs = require('fs');

let content = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');

// Update props interface
content = content.replace(
  "interface WatchPageProps {\n  item: any;",
  "import { ListVideo, X } from 'lucide-react';\n\ninterface WatchPageProps {\n  onPlay?: () => void;\n  isProviderActive?: boolean;\n  providerIframeUrl?: string | null;\n  onToggleEpisodes?: () => void;\n  item: any;"
);

// Destructure new props
content = content.replace(
  "seasonData, forceFullScreen }: WatchPageProps)",
  "seasonData, forceFullScreen, onPlay, isProviderActive, providerIframeUrl, onToggleEpisodes }: WatchPageProps)"
);

// Add Play button handler
content = content.replace(
  '<button className="bg-white text-black px-6 py-2.5 md:px-8 md:py-3.5 rounded-full font-bold flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-2xl text-sm md:text-base">',
  '<button onClick={() => onPlay && onPlay()} className="bg-white text-black px-6 py-2.5 md:px-8 md:py-3.5 rounded-full font-bold flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-2xl text-sm md:text-base">'
);

// When isProviderActive is true, replace the layer 0/1/2/hero with just the provider iframe, or overlay the iframe on top.
// We can just add a new div at the end if `isProviderActive` is true.

const providerLayer = `
      {/* Layer 3: Provider iframe */}
      {isProviderActive && providerIframeUrl && (
        <div className="absolute inset-0 z-40 bg-black">
          <iframe
            src={providerIframeUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
          {type !== 'movie' && (
            <div className="absolute top-6 right-6 z-50 transition-opacity duration-300 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEpisodes && onToggleEpisodes();
                }}
                className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
                aria-label="Episodes"
              >
                <ListVideo className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
        </div>
      )}
`;

content = content.replace(
  "    </div>\n  );\n}",
  providerLayer + "\n    </div>\n  );\n}"
);

fs.writeFileSync('src/components/WatchPage.tsx', content);
console.log('updated src/components/WatchPage.tsx');
