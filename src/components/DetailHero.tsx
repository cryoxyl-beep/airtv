import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { IMAGE_BASE_URL, getCachedLogo, fetchTrailer } from '../api/tmdb';

interface DetailHeroProps {
  item: any;
  type: 'movie' | 'tv' | 'anime';
  onWatchNow: () => void;
}

export default function DetailHero({ item, type, onWatchNow }: DetailHeroProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (item) {
      setLogoUrl(getCachedLogo(item));
    }
  }, [item]);

  const title = item?.title || item?.name || (item?.title?.english) || (item?.title?.romaji) || '';
  const backdropPath = item?.backdrop_path || item?.bannerImage || item?.coverImage?.extraLarge;
  const overview = item?.overview || item?.description?.replace(/<[^>]*>?/gm, '') || '';
  const year = item?.release_date ? new Date(item.release_date).getFullYear() : (item?.first_air_date ? new Date(item.first_air_date).getFullYear() : (item?.seasonYear || item?.startDate?.year));
  const runtime = item?.runtime || item?.episode_run_time?.[0] || item?.duration;
  
  return (
    <div className="relative w-full h-[70vh] lg:h-[85vh] bg-black">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-transparent to-transparent z-10" />
        {backdropPath && (
          <img
            src={backdropPath.startsWith('http') ? backdropPath : `${IMAGE_BASE_URL}${backdropPath}`}
            alt={title}
            className="w-full h-full object-cover object-center opacity-60"
          />
        )}
      </div>

      {/* Content */}
      <div className="relative z-20 h-full flex items-center px-6 md:px-12 lg:px-16 pt-20">
        <div className="w-full max-w-2xl">
          {logoUrl ? (
            <img 
              src={logoUrl.startsWith('http') ? logoUrl : `${IMAGE_BASE_URL}${logoUrl}`} 
              alt={title}
              className="max-h-24 md:max-h-32 mb-6 object-contain object-left"
            />
          ) : (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 drop-shadow-lg tracking-tight">
              {title}
            </h1>
          )}

          <div className="flex items-center gap-4 text-white/70 text-sm md:text-base font-medium mb-6">
            {year && <span>{year}</span>}
            {runtime && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span>{runtime}m</span>
              </>
            )}
            {item?.vote_average && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span className="flex items-center gap-1 text-green-400">
                  ★ {Number(item.vote_average).toFixed(1)}
                </span>
              </>
            )}
            {item?.genres && item.genres.length > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span>{item.genres.map((g: any) => g.name || g).slice(0, 2).join(', ')}</span>
              </>
            )}
          </div>

          <p className="text-white/80 text-sm md:text-base line-clamp-3 md:line-clamp-4 leading-relaxed mb-8 max-w-xl text-shadow-sm">
            {overview}
          </p>

          <button
            onClick={onWatchNow}
            className="flex items-center gap-2 bg-white text-black px-6 md:px-8 py-3 md:py-3.5 rounded-lg font-bold hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-[0_4px_14px_rgba(255,255,255,0.25)] group"
          >
            <Play className="w-5 h-5 fill-current" />
            <span className="tracking-wide">Watch Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
