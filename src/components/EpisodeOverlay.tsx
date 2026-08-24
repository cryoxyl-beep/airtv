import React, { useRef, useEffect } from 'react';
import SeasonSelector from './SeasonSelector';
import { IMAGE_BASE_URL_W500 } from '../api/tmdb';

interface EpisodeOverlayProps {
  type: 'tv' | 'anime';
  data: any;
  seasonData: any;
  currentSeason: number;
  currentEpisode: number;
  onSeasonChange: (season: number) => void;
  onEpisodeSelect: (episode: number) => void;
  id: string | undefined;
  onClose?: () => void;
}

export default function EpisodeOverlay({ type, data, seasonData, currentSeason, currentEpisode, onSeasonChange, onEpisodeSelect, id, onClose }: EpisodeOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Allow mouse wheel to scroll horizontally
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollBy({
          left: e.deltaY > 0 ? 300 : -300,
          behavior: 'smooth'
        });
      }
    };
    
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const episodes = seasonData?.episodes || [];

  return (
    <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-md flex flex-col justify-end pb-12 pointer-events-auto">
      <div className="w-full max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col gap-4">
        {onClose && (
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        )}
        {/* Season Selector */}
        {type === 'tv' && data.seasons && (
          <div className="w-fit">
            <SeasonSelector 
              seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
              currentSeason={currentSeason}
              onSeasonChange={onSeasonChange}
            />
          </div>
        )}
        
        {type === 'anime' && data.animeGroup && data.animeGroup.seasons && data.animeGroup.seasons.length > 1 && (
          <div className="w-fit">
            <SeasonSelector 
              seasons={data.animeGroup.seasons.map((s: any) => ({
                id: s.anilistId,
                season_number: s.anilistId,
                name: s.displayTitle
              }))} 
              currentSeason={parseInt(id || "0")}
              onSeasonChange={onSeasonChange}
            />
          </div>
        )}

        <div className="text-white/80 font-medium text-lg px-2">
          {episodes.length} Episodes
        </div>

        {/* Horizontal Episode List */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-6 pt-2 px-2 snap-x scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {episodes.map((episode: any) => {
            const isActive = episode.episode_number === currentEpisode;
            return (
              <div 
                key={episode.id || episode.episode_number}
                onClick={() => onEpisodeSelect(episode.episode_number)}
                className={`flex-none w-64 md:w-72 flex flex-col gap-3 group cursor-pointer snap-start transition-all duration-300 hover:scale-105 ${isActive ? 'scale-105' : ''}`}
              >
                <div className={`relative aspect-video rounded-md overflow-hidden bg-[#141414] border ${isActive ? 'border-white' : 'border-white/10 group-hover:border-white/30'} transition-colors`}>
                  {episode.still_path ? (
                    <img 
                      src={(episode.still_path?.startsWith('http') ? episode.still_path : `${IMAGE_BASE_URL_W500}${episode.still_path}`)}
                      alt={episode.name}
                      className={`w-full h-full object-cover transition-all duration-300 ${isActive ? 'brightness-110' : 'group-hover:brightness-110'}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      No Image
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 ring-2 ring-white ring-inset rounded-md pointer-events-none" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className={`font-bold text-sm truncate ${isActive ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                    {episode.episode_number}. {episode.name}
                  </h3>
                  {type === 'tv' && (
                    <p className="text-xs text-white/50 line-clamp-2">
                      {episode.overview || "No description available."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
