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
            className="flex flex-col gap-3 group cursor-pointer"
          >
            {/* Image Container */}
            <div className={`relative aspect-video rounded-md overflow-hidden bg-[#141414] transition-all duration-300
              ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0b0b0b]' : 'group-hover:ring-1 group-hover:ring-white/50 group-hover:ring-offset-1 group-hover:ring-offset-[#0b0b0b]'}
            `}>
              {episode.still_path ? (
                <img 
                  src={`${IMAGE_BASE_URL_W500}${episode.still_path}`}
                  alt={episode.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  No Image
                </div>
              )}
              
              {/* Play icon overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center pl-1 backdrop-blur-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 3L19 12L5 21V3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {isActive && (
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-white border border-white/20">
                  Playing
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                      <polyline points="17 2 12 7 7 2"></polyline>
                    </svg>
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
