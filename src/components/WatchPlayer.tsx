import React, { useEffect, useState } from 'react';
import { IMAGE_BASE_URL, resolveLogo, getCachedLogo } from '../api/tmdb';
import { Play, ThumbsUp, ThumbsDown } from 'lucide-react';

interface WatchPlayerProps {
  item: any;
  type: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  seasonData?: any;
}

export default function WatchPlayer({ item, type, seasonNumber, episodeNumber, seasonData }: WatchPlayerProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(getCachedLogo(item));
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  useEffect(() => {
    let mounted = true;
    resolveLogo(item).then(url => {
      if (mounted && url) {
        setLogoUrl(url);
      }
    });
    return () => { mounted = false; };
  }, [item]);

  // Determine the best backdrop to show while loading
  let backdropPath = item?.backdrop_path;
  
  // If TV, try to show the episode still as the backdrop
  if (type === 'tv' && seasonData && episodeNumber) {
    const episode = seasonData.episodes?.find((e: any) => e.episode_number === episodeNumber);
    if (episode?.still_path) {
      backdropPath = episode.still_path;
    }
  }

  const overviewText = item.overview;

  return (
    <div className={`relative w-full bg-black overflow-hidden group ${type === 'movie' ? 'h-screen' : 'aspect-video md:aspect-[21/9] lg:aspect-[21/9] xl:aspect-[24/9]'}`}>
      
      {/* Fallback / Loading Image */}
      <div className="absolute inset-0 w-full h-full z-0">
        {backdropPath ? (
          <img 
            src={`${IMAGE_BASE_URL}${backdropPath}`} 
            alt="Backdrop" 
            className="w-full h-full object-cover opacity-60 md:opacity-80"
          />
        ) : (
          <div className="w-full h-full bg-[#111] animate-pulse" />
        )}
        {/* Gradients for blending and text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent w-full md:w-[70%] pointer-events-none" />
      </div>

      {/* Hero Content (Logo, Watch Now Button, Metadata) */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end px-6 pb-6 pt-16 md:px-12 md:pb-10 lg:px-16 lg:pb-12 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-12 w-full max-w-7xl mx-auto h-full">
          
          {/* Left Side: Logo/Title & Buttons */}
          <div className="flex flex-col items-start justify-end gap-4 md:gap-5 shrink-0 md:w-5/12 lg:w-1/2 flex-1">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={item.title || item.name} 
                className="h-20 md:h-28 lg:h-36 max-w-[260px] md:max-w-[400px] lg:max-w-[480px] object-contain object-left drop-shadow-2xl"
              />
            ) : (
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-white drop-shadow-lg text-left uppercase">
                {item.title || item.name}
              </h2>
            )}

            <div className="flex items-center gap-3 w-full pb-1 md:pb-2 mt-2">
              <button className="bg-white text-black px-6 py-2.5 md:px-8 md:py-3.5 rounded-full font-bold flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-2xl text-sm md:text-base">
                <Play className="w-4 h-4 md:w-5 md:h-5 fill-current text-black" /> 
                Watch Now
              </button>

              <button 
                onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 transition-all shadow-xl ml-2"
                aria-label="Like"
              >
                <ThumbsUp className={`w-4 h-4 md:w-5 md:h-5 ${feedback === 'like' ? 'fill-current text-white' : 'text-white'}`} />
              </button>

              <button 
                onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 transition-all shadow-xl"
                aria-label="Dislike"
              >
                <ThumbsDown className={`w-4 h-4 md:w-5 md:h-5 ${feedback === 'dislike' ? 'fill-current text-white' : 'text-white'}`} />
              </button>
            </div>
          </div>

          {/* Right Side: Metadata & Description */}
          <div className="flex flex-col gap-2 md:gap-3 md:w-7/12 lg:w-1/2 md:pb-2">
            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm lg:text-base text-white/70 font-medium">
              {type === 'movie' && item.release_date && (
                <>
                  <span>{new Date(item.release_date).getFullYear()}</span>
                  {item.runtime && <span>{Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span>}
                </>
              )}
              {type === 'tv' && item.first_air_date && (
                <>
                  <span>{new Date(item.first_air_date).getFullYear()}</span>
                  {item.number_of_seasons && <span>{item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}</span>}
                </>
              )}
              <div className="flex items-center gap-2">
                {item.genres?.slice(0, 3).map((g: any, i: number) => (
                  <span key={g.id}>
                    {g.name}
                    {i < Math.min(item.genres.length, 3) - 1 ? ' • ' : ''}
                  </span>
                ))}
              </div>
            </div>
            
            {overviewText && (
              <p className="text-xs md:text-sm lg:text-base text-white/80 leading-relaxed line-clamp-3 lg:line-clamp-4 text-shadow-sm">
                {overviewText}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
