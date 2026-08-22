import React from 'react';
import { IMAGE_BASE_URL_W500 } from '../api/tmdb';

interface EpisodeListProps {
  episodes: any[];
  currentEpisode: number;
  onEpisodeSelect: (episodeNumber: number) => void;
}

export default function EpisodeList({ episodes, currentEpisode, onEpisodeSelect }: EpisodeListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {episodes.map((episode) => {
        const isActive = episode.episode_number === currentEpisode;
        
        return (
          <div 
            key={episode.id}
            onClick={() => onEpisodeSelect(episode.episode_number)}
            className="flex flex-col gap-3 group cursor-pointer relative z-10 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-110"
          >
            {/* Image Container */}
            <div className={`relative aspect-video rounded-md overflow-hidden bg-[#141414] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] group-hover:border-white/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.15)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] z-20
              ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0b0b0b]' : ''}
            `}>
              {episode.still_path ? (
                <img 
                  src={`${IMAGE_BASE_URL_W500}${episode.still_path}`}
                  alt={episode.name}
                  className="w-full h-full object-cover transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] group-hover:scale-105 group-hover:brightness-110"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] group-hover:brightness-110">
                  No Image
                </div>
              )}
            </div>

            {/* Content Info */}
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-base text-white/90 group-hover:text-white transition-colors truncate">
                {episode.episode_number}. {episode.name}
              </h3>
              
              <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                {episode.overview || "No description available."}
              </p>
              
              {/* Metadata row */}
              <div className="flex items-center gap-3 mt-1 text-xs text-white/40 font-medium">
                {/* Mock rating */}
                <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">U/A 16+</span>
                
                {episode.runtime && (
                  <span className="flex items-center gap-1">
                    {episode.runtime}min
                  </span>
                )}
                
                {episode.air_date && (
                  <span>
                    {new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
