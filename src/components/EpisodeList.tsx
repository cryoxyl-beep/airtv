import React from 'react';
import { IMAGE_BASE_URL_W500 } from '../api/tmdb';

interface EpisodeListProps {
  episodes: any[];
  currentEpisode: number;
  onEpisodeSelect: (episodeNumber: number) => void;
  isAnime?: boolean;
}

export default function EpisodeList({ episodes, currentEpisode, onEpisodeSelect, isAnime }: EpisodeListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
      {episodes.map((episode) => {
        const isActive = episode.episode_number === currentEpisode;
        
        return (
          <div 
            key={episode.id || episode.episode_number}
            onClick={() => onEpisodeSelect(episode.episode_number)}
            className="flex flex-col gap-3 group cursor-pointer relative"
          >
            {/* Image Container */}
            <div className={`relative aspect-video rounded-xl overflow-hidden bg-[#141414] border transition-all duration-300 shadow-lg ${isActive ? 'border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.15)] ring-2 ring-white ring-offset-2 ring-offset-[#0b0b0b]' : 'border-white/10 group-hover:border-white/30'}`}>
              {episode.still_path ? (
                <img 
                  src={(episode.still_path?.startsWith('http') ? episode.still_path : `${IMAGE_BASE_URL_W500}${episode.still_path}`)}
                  alt={episode.name}
                  className={`w-full h-full object-cover transition-all duration-500 ease-out ${isActive ? 'brightness-110 scale-105' : 'brightness-75 group-hover:brightness-100 group-hover:scale-105'}`}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 bg-[#1a1a1a]">
                  <span className="text-sm font-medium">No Image</span>
                </div>
              )}

              {/* Active State Overlay */}
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 opacity-100">
                  <div className="flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 transition-transform duration-300 w-12 h-12 scale-100 shadow-xl">
                    <div className="flex gap-1 items-center justify-center h-4">
                      <div className="w-1 h-full bg-white animate-[pulse_1s_ease-in-out_infinite]" />
                      <div className="w-1 h-full bg-white animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
                      <div className="w-1 h-full bg-white animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Content Info */}
            <div className="flex flex-col gap-1.5 px-1">
              <h3 className={`font-semibold text-base truncate transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`}>
                <span className={isActive ? 'text-white font-bold' : 'text-white/40 font-medium'}>{episode.episode_number}.</span> {episode.name}
              </h3>
              
              {!isAnime && (
                <>
                  <p className="text-sm text-white/40 line-clamp-2 leading-relaxed">
                    {episode.overview || "No description available."}
                  </p>
                  
                  {/* Metadata row */}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/40 font-medium uppercase tracking-wider">
                    <span className="bg-white/10 px-2 py-0.5 rounded-sm text-white/70 border border-white/5">U/A 16+</span>
                    
                    {episode.runtime && (
                      <span className="flex items-center gap-1">
                        {episode.runtime} min
                      </span>
                    )}
                    
                    {episode.air_date && (
                      <span>
                        {new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
