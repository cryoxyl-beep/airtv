import React, { useEffect, useRef } from 'react';
import SeasonSelector from './SeasonSelector';
import { IMAGE_BASE_URL_W500 } from '../api/tmdb';
import { X } from 'lucide-react';

interface EpisodePanelProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'tv' | 'anime';
  data: any;
  seasonData: any;
  seasonNumber: number;
  episodeNumber: number;
  onSeasonChange: (seasonNumber: number) => void;
  onEpisodeChange: (episodeNumber: number) => void;
  isAnime: boolean;
}

export default function EpisodePanel({
  isOpen, onClose, type, data, seasonData, seasonNumber, episodeNumber,
  onSeasonChange, onEpisodeChange, isAnime
}: EpisodePanelProps) {
  
  const episodes = seasonData?.episodes || [];
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll to selected episode when opened
  useEffect(() => {
    if (isOpen && selectedRef.current) {
      setTimeout(() => {
        selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isOpen, episodeNumber]);

  return (
    <>
      {/* Backdrop for mobile (optional) */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div 
        className={`fixed z-50 flex flex-col bg-[#0b0b0b]/90 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.8),-4px_0_20px_rgba(255,255,255,0.02)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1.2)]
          /* Mobile: Bottom Sheet */
          bottom-0 left-0 right-0 h-[70vh] rounded-t-3xl translate-y-full
          ${isOpen ? 'max-md:translate-y-0' : ''}
          /* Desktop: Right Panel overlay */
          md:top-6 md:bottom-6 md:right-6 md:left-auto md:w-[400px] md:h-auto md:rounded-3xl md:translate-x-full
          ${isOpen ? 'md:translate-x-0' : ''}
        `}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-5 md:p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Episodes</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Season Selector */}
        <div className="flex-shrink-0 p-5 md:p-6 pb-2">
          {type === 'tv' && data?.seasons && (
            <SeasonSelector 
              seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
              currentSeason={seasonNumber}
              onSeasonChange={onSeasonChange}
            />
          )}
          {isAnime && data?.animeGroup?.seasons && data.animeGroup.seasons.length > 1 && (
            <SeasonSelector 
              seasons={data.animeGroup.seasons.map((s: any) => ({
                id: s.anilistId,
                season_number: s.anilistId,
                name: s.displayTitle
              }))} 
              currentSeason={seasonNumber}
              onSeasonChange={onSeasonChange}
            />
          )}
        </div>

        {/* Episode List */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-6 space-y-2 custom-scrollbar">
          {episodes.map((episode: any) => {
            const isActive = episode.episode_number === episodeNumber;
            return (
              <button
                key={episode.id || episode.episode_number}
                ref={isActive ? selectedRef : null}
                onClick={() => {
                  onEpisodeChange(episode.episode_number);
                  // Optional: Close on mobile automatically, or stay open? 
                  // Prompt says "When playback resumes: smoothly hide the episode selector again". 
                  // Clicking an episode initiates playback usually, so we can just close it.
                  onClose(); 
                }}
                className={`w-full text-left flex gap-4 p-2 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? 'bg-white/10 border border-white/20 shadow-lg' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="relative w-[120px] shrink-0 aspect-video rounded-lg overflow-hidden bg-[#141414]">
                  {episode.still_path ? (
                    <img 
                      src={(episode.still_path?.startsWith('http') ? episode.still_path : `${IMAGE_BASE_URL_W500}${episode.still_path}`)}
                      alt={episode.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">No Image</div>
                  )}
                  {/* Active Indicator Overlay */}
                  {isActive && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center border-2 border-white/50 rounded-lg">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                      {episode.episode_number}. {episode.name || `Episode ${episode.episode_number}`}
                    </span>
                  </div>
                  {!isAnime && episode.runtime && (
                    <span className="text-xs text-white/40 font-medium">
                      {episode.runtime}m
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          
          {episodes.length === 0 && (
            <div className="text-center py-10 text-white/40">
              No episodes found.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
