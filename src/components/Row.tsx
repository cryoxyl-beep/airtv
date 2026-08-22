import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IMAGE_BASE_URL_W500, resolveLogo, fetchTrailer } from '../api/tmdb';

interface RowProps {
  title: string;
  items: any[];
  isTop10?: boolean;
}

const RowCard = ({ item, isTop10, index }: { item: any; isTop10: boolean; index: number }) => {
  const [logo, setLogo] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let mounted = true;
    const getLogo = async () => {
      setLoadingLogo(true);
      try {
        const foundLogo = await resolveLogo(item);
        if (!mounted) return;
        if (foundLogo) {
          setLogo(foundLogo);
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoadingLogo(false);
      }
    };
    getLogo();
    return () => {
      mounted = false;
    };
  }, [item, isVisible]);

  useEffect(() => {
    if (isHovered) {
      let isCurrent = true;
      fetchTrailer(item.id, item.media_type || (item.first_air_date ? 'tv' : 'movie')).then(key => {
        if (isCurrent && key) setTrailerKey(key);
      });

      hoverTimerRef.current = setTimeout(() => {
        if (isCurrent) setShowTrailer(true);
      }, 5000);

      return () => {
        isCurrent = false;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      };
    } else {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setShowTrailer(false);
      setIsPlaying(false);
    }
  }, [isHovered, item]);

  useEffect(() => {
    if (!showTrailer || !trailerKey) return;
    
    let isCurrent = true;
    let playerInitTimer: ReturnType<typeof setTimeout>;

    const initPlayer = () => {
      const yt = (window as any).YT;
      const playerId = `row-trailer-${item.id}`;
      if (yt && yt.Player) {
        new yt.Player(playerId, {
          events: {
            onReady: (event: any) => {
              if (event.target.unloadModule) event.target.unloadModule('captions');
            },
            onApiChange: (event: any) => {
              if (event.target.unloadModule) event.target.unloadModule('captions');
            },
            onStateChange: (event: any) => {
              if (event.data === 1) {
                if (isCurrent) setIsPlaying(true);
              }
            }
          }
        });
      } else {
        playerInitTimer = setTimeout(initPlayer, 100);
      }
    };
    
    initPlayer();

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.event === 'onStateChange' && data.info === 1) {
          if (isCurrent) setIsPlaying(true);
        }
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    
    // Fallback: if we never get the playing event, reveal after 2.5 seconds anyway
    const fallbackTimer = setTimeout(() => {
      if (isCurrent) setIsPlaying(true);
    }, 2500);

    return () => {
      isCurrent = false;
      clearTimeout(playerInitTimer);
      clearTimeout(fallbackTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, [showTrailer, trailerKey]);

  return (
    <div
      ref={cardRef}
      className={`flex-shrink-0 cursor-pointer flex items-center group ${
        isTop10 ? 'gap-2 md:gap-4' : 'w-[300px] md:w-[400px] lg:w-[450px]'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isTop10 && (
        <div className="flex-shrink-0 flex items-center justify-center z-10">
          <span
            className="text-[90px] md:text-[110px] font-sans font-bold leading-none pointer-events-none select-none tracking-normal transition-all duration-300"
            style={{
              WebkitTextStroke: isHovered ? '1.5px rgba(255, 255, 255, 1)' : '1.5px rgba(255, 255, 255, 0.4)',
              color: isHovered ? 'white' : 'transparent',
            }}
          >
            {(index + 1).toString().padStart(2, '0')}
          </span>
        </div>
      )}
      
      <div className={`relative rounded-md overflow-hidden bg-[#141414] aspect-video z-20 transition-all duration-300 ${isHovered ? 'scale-105 shadow-2xl z-50' : 'shadow-xl'} ${isTop10 ? 'w-[220px] md:w-[280px] lg:w-[320px] -ml-2 md:-ml-4' : 'w-full'}`}>
        
        {/* Countdown Indicator */}
        <div className="absolute top-2 right-2 z-50 pointer-events-none">
          <svg className={`w-5 h-5 md:w-6 md:h-6 -rotate-90 transition-opacity duration-300 ${isHovered && !isPlaying ? 'opacity-100' : 'opacity-0'}`} viewBox="0 0 24 24">
            <circle className="text-black/50" strokeWidth="2" stroke="currentColor" fill="transparent" r="10" cx="12" cy="12" />
            <circle 
              className="text-white drop-shadow-md transition-[stroke-dashoffset] ease-linear" 
              strokeWidth="2" 
              strokeDasharray="62.83" 
              strokeDashoffset={isHovered ? 0 : 62.83} 
              style={{ transitionDuration: isHovered ? '5s' : '0s' }}
              stroke="currentColor" 
              fill="transparent" 
              r="10" cx="12" cy="12" 
            />
          </svg>
        </div>

        {/* 1. Trailer Iframe Layer (z-0, pointer-events-none) */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#0b0b0b] pointer-events-none">
          {showTrailer && trailerKey && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-full h-full scale-[1.15] pointer-events-none">
              <iframe
                id={`row-trailer-${item.id}`}
                key={`iframe-${item.id}`}
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&loop=1&playlist=${trailerKey}&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${window.location.origin}&cc_load_policy=0`}
                className="w-full h-full pointer-events-none object-cover"
                allow="autoplay; encrypted-media"
                tabIndex={-1}
              />
            </div>
          )}
        </div>

        {/* 3. Invisible Blocker Div (z-10) directly above iframe */}
        <div className="absolute inset-0 z-10 pointer-events-auto" />

        {/* 4. Poster Layer (z-20) */}
        <div className={`absolute inset-0 w-full h-full z-20 transition-opacity duration-700 ease-in-out pointer-events-none ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
          <img
            src={`${IMAGE_BASE_URL_W500}${item.backdrop_path}`}
            alt={item.title || item.name}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        </div>

        {/* Card Title/Hover UI (z-30) */}
        <div className={`absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end items-center p-4 pointer-events-none z-30 transition-opacity duration-700 ease-in-out ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
          {loadingLogo ? (
            <div className="w-[60%] h-6 bg-white/20 animate-pulse rounded"></div>
          ) : logo ? (
            <img
              src={logo}
              alt={item.title || item.name}
              className="max-h-12 max-w-[80%] object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <h3 className="text-white font-bold text-lg drop-shadow-md text-center">
              {item.title || item.name}
            </h3>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Row({ title, items, isTop10 = false }: RowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (rowRef.current?.offsetLeft || 0));
    setScrollLeft(rowRef.current?.scrollLeft || 0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (rowRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (rowRef.current) {
      rowRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  return (
    <div className="relative mb-8 group/row">
      <div className="flex items-center justify-between pl-12 pr-12 mb-2">
        <h2 className="text-2xl font-bold text-white tracking-wide">{title}</h2>
      </div>
      
      <div
        ref={rowRef}
        className={`flex items-center overflow-x-auto scrollbar-hide ${isTop10 ? 'gap-8 py-4' : 'gap-4 py-8'} ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div className={`${isTop10 ? 'w-4' : 'w-8'} shrink-0`} />
        {items.map((item, index) => {
          if (!item.backdrop_path) return null;
          return <RowCard key={item.id} item={item} isTop10={isTop10} index={index} />;
        })}
        <div className={`${isTop10 ? 'w-4' : 'w-8'} shrink-0`} />
      </div>
    </div>
  );
}
