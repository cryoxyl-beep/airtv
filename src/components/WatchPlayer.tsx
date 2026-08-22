import React, { useEffect, useState } from 'react';
import { IMAGE_BASE_URL, resolveLogo, getCachedLogo } from '../api/tmdb';
import { Play } from 'lucide-react';

interface WatchPlayerProps {
  item: any;
  type: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  seasonData?: any;
}

export default function WatchPlayer({ item, type, seasonNumber, episodeNumber, seasonData }: WatchPlayerProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(getCachedLogo(item));

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

  const overviewText = type === 'tv' && seasonData?.episodes?.find((e: any) => e.episode_number === episodeNumber)?.overview 
    ? seasonData.episodes.find((e: any) => e.episode_number === episodeNumber).overview 
    : item.overview;

  return (
    <div className="relative w-full aspect-video md:aspect-[21/9] lg:aspect-[21/9] xl:aspect-[24/9] bg-black overflow-hidden group">
      
      {/* Fallback / Loading Image */}
      <div className="absolute inset-0 w-full h-full z-0">
        {backdropPath ? (
          <img 
            src={`${IMAGE_BASE_URL}${backdropPath}`} 
            alt="Backdrop" 
            className="w-full h-full object-cover opacity-60 md:opacity-80"
          />
        ) : (
          <div className="w-full h-full bg-[#111]" />
        )}
        {/* Gradients for blending and text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent w-full md:w-[70%] pointer-events-none" />
      </div>

      {/* Hero Content (Logo, Watch Now Button, Metadata) */}
      <div className="absolute inset-0 z-10 flex flex-col items-start justify-end gap-4 p-6 md:p-12 lg:p-16 w-full max-w-4xl">
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={item.title || item.name} 
            className="h-10 md:h-14 lg:h-16 max-w-[200px] md:max-w-[280px] object-contain object-left drop-shadow-2xl"
          />
        ) : (
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg text-left uppercase">
            {item.title || item.name}
          </h2>
        )}

        <button className="bg-white text-black px-6 py-2.5 md:px-8 md:py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 shadow-2xl text-sm md:text-base mt-2">
          <Play className="w-4 h-4 md:w-5 md:h-5 fill-current text-black" /> 
          Watch Now
        </button>

        <div className="flex flex-col gap-2 mt-2 md:mt-4 w-full max-w-2xl">
          <div className="flex items-center gap-3 text-xs md:text-sm text-white/70 font-medium">
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
            <p className="text-xs md:text-sm lg:text-base text-white/80 leading-relaxed line-clamp-2 md:line-clamp-3 text-shadow-sm">
              {overviewText}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
