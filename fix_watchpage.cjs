const fs = require('fs');
let code = fs.readFileSync('src/components/WatchPage.tsx', 'utf-8');

// Add Plus to imports
code = code.replace(
  "import { Play, ThumbsUp, ThumbsDown, Volume2, VolumeX, ListVideo } from 'lucide-react';",
  "import { Play, ThumbsUp, ThumbsDown, Volume2, VolumeX, ListVideo, Plus } from 'lucide-react';"
);

// Replace the hero content
const oldHeroContentStart = "{/* Hero Content (Logo, Watch Now Button, Metadata) */}";
const oldHeroContentEnd = "      {/* Provider iframe removed, now in PlayerPage */}";

const startIdx = code.indexOf(oldHeroContentStart);
const endIdx = code.indexOf(oldHeroContentEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const newHeroContent = `{/* Hero Content (Logo, Metadata, Description, Buttons) */}
      <div className="absolute inset-0 z-30 flex flex-col justify-end px-6 pb-6 pt-16 md:px-12 md:pb-10 lg:px-16 lg:pb-12 w-full pointer-events-none">
        <div className="flex flex-col items-start justify-end gap-3 md:gap-4 shrink-0 md:w-3/4 lg:w-3/5 xl:w-1/2 flex-1 pointer-events-none">
          
          <div className="transition-opacity duration-500 mb-1 md:mb-2">
            {logoUrl ? (
              <>
                <img 
                  src={logoUrl} 
                  alt={item.title || item.name} 
                  className="h-20 md:h-28 lg:h-36 max-w-[260px] md:max-w-[400px] lg:max-w-[480px] object-contain object-left drop-shadow-2xl"
                />
                {type === 'anime' && (
                  <p className="mt-2 text-white/90 text-sm md:text-base lg:text-lg font-bold tracking-wide drop-shadow-md">
                    {item.title || item.name}
                  </p>
                )}
              </>
            ) : (
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-white drop-shadow-lg text-left uppercase">
                {item.title || item.name}
              </h2>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm lg:text-[15px] text-white/90 drop-shadow-md font-medium">
            <span className="border border-white/40 text-white px-1.5 py-0.5 rounded-sm text-[10px] md:text-xs leading-none">
              {item.adult ? '18+' : '13+'}
            </span>
            {type === 'movie' && item.release_date && (
              <>
                <span>{new Date(item.release_date).getFullYear()}</span>
                <span className="text-white/40">&bull;</span>
                {item.runtime && (
                  <>
                    <span>{Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span>
                    <span className="text-white/40">&bull;</span>
                  </>
                )}
              </>
            )}
            {type === 'tv' && item.first_air_date && (
              <>
                <span>{new Date(item.first_air_date).getFullYear()}</span>
                <span className="text-white/40">&bull;</span>
              </>
            )}
            {type === 'anime' && (
              <>
                <span>{item.first_air_date ? new Date(item.first_air_date).getFullYear() : (item.release_date ? new Date(item.release_date).getFullYear() : '')}</span>
                <span className="text-white/40">&bull;</span>
              </>
            )}
            
            <div className="flex items-center gap-1.5">
              {item.genres?.slice(0, 3).map((g, i) => (
                <span key={g.id}>
                  {g.name}
                  {i < Math.min(item.genres.length, 3) - 1 ? ', ' : ''}
                </span>
              ))}
            </div>

            {type === 'tv' && item.number_of_seasons && (
              <>
                <span className="text-white/40">&bull;</span>
                <span>{item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}</span>
              </>
            )}
            {type === 'anime' && item.animeGroup && item.animeGroup.seasons && item.animeGroup.seasons.length > 1 && (
              <>
                <span className="text-white/40">&bull;</span>
                <span>{item.animeGroup.seasons.length} Seasons</span>
              </>
            )}
          </div>
          
          {overviewText && (
            <p className="text-xs md:text-sm lg:text-[15px] text-white/80 leading-relaxed line-clamp-3 md:line-clamp-4 drop-shadow-lg font-normal mb-1 md:mb-3 max-w-2xl lg:max-w-3xl">
              {overviewText}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 w-full pb-1 pointer-events-auto">
            <button onClick={() => onPlay && onPlay()} className="bg-white text-black px-6 py-2.5 md:px-8 md:py-3.5 rounded-full font-bold flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-2xl text-sm md:text-[15px]">
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-current text-black" /> 
              Watch Now
            </button>
            
            <div className="flex items-center gap-2 md:gap-3">
              <button 
                className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group ml-1"
                aria-label="Add to List"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </button>
              <button 
                onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
                className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
                aria-label="Like"
              >
                <ThumbsUp className={\`w-4 h-4 md:w-5 md:h-5 \${feedback === 'like' ? 'fill-current text-white' : 'text-white'}\`} />
              </button>
              <button 
                onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
                className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
                aria-label="Dislike"
              >
                <ThumbsDown className={\`w-4 h-4 md:w-5 md:h-5 \${feedback === 'dislike' ? 'fill-current text-white' : 'text-white'}\`} />
              </button>
            </div>
          </div>

        </div>
      </div>
`;
  
  code = code.substring(0, startIdx) + newHeroContent + code.substring(endIdx);
  fs.writeFileSync('src/components/WatchPage.tsx', code);
}
