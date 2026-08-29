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

  
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const dragDistance = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    dragDistance.current = 0;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
    dragDistance.current = Math.abs(x - startX.current);
  };

  const handleEpisodeClick = (episode_number: number) => {
    if (dragDistance.current > 5) return;
    onEpisodeSelect(episode_number);
  };

  const episodes = seasonData?.episodes || [];

  // Auto-scroll to active episode on mount
  useEffect(() => {
    // Small delay to ensure the DOM is fully rendered
    const timer = setTimeout(() => {
      const activeCard = document.getElementById('active-episode-card');
      if (activeCard && scrollRef.current) {
        activeCard.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [currentSeason, episodes.length]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Bottom Panel */}
      <div className="w-full relative z-10 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b] to-transparent pt-32 pb-8 pointer-events-auto animate-in slide-in-from-bottom-8 duration-500 ease-out">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col gap-6">
          
          {/* Header */}
          <div className="flex items-end justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-4 md:gap-6 flex-wrap">
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

              <div className="text-white/60 font-medium text-sm bg-white/5 px-4 py-1.5 rounded-full border border-white/5 shadow-sm">
                {episodes.length} Episodes
              </div>
            </div>

            {onClose && (
              <button onClick={onClose} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md border border-white/5 shadow-sm mb-1" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            )}
          </div>

          {/* Horizontal Episode List */}
          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-6 pt-2 px-2 scrollbar-hide cursor-grab active:cursor-grabbing select-none -mx-2"
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {episodes.map((episode: any) => {
              const isActive = episode.episode_number === currentEpisode;
              return (
                <div 
                  id={isActive ? 'active-episode-card' : undefined}
                  key={episode.id || episode.episode_number}
                  onClick={() => handleEpisodeClick(episode.episode_number)}
                  className={`flex-none w-64 md:w-72 flex flex-col gap-3 group transition-all duration-300 ${isActive ? 'scale-105' : 'hover:scale-105'}`}
                >
                  <div className={`relative aspect-video rounded-xl overflow-hidden bg-[#141414] border transition-all duration-300 shadow-lg ${isActive ? 'border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'border-white/10 group-hover:border-white/30'}`}>
                    {episode.still_path ? (
                      <img 
                        src={(episode.still_path?.startsWith('http') ? episode.still_path : `${IMAGE_BASE_URL_W500}${episode.still_path}`)}
                        alt={episode.name}
                        className={`w-full h-full object-cover transition-all duration-500 ease-out ${isActive ? 'brightness-110 scale-105' : 'brightness-75 group-hover:brightness-100 group-hover:scale-105'}`}
                        loading="lazy" draggable={false} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 bg-[#1a1a1a]">
                        <span className="text-sm font-medium">No Image</span>
                      </div>
                    )}
                    
                    {/* Active State Overlay */}
                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 opacity-100">
                        <div className="flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 transition-transform duration-300 w-12 h-12 scale-100">
                          <div className="flex gap-1 items-center justify-center h-4">
                            <div className="w-1 h-full bg-white animate-[pulse_1s_ease-in-out_infinite]" />
                            <div className="w-1 h-full bg-white animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
                            <div className="w-1 h-full bg-white animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 px-1">
                    <h3 className={`font-semibold text-sm truncate transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`}>
                      <span className={isActive ? 'text-white font-bold' : 'text-white/40 font-medium'}>{episode.episode_number}.</span> {episode.name}
                    </h3>
                    {type === 'tv' && (
                      <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">
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
    </div>
  );
}
