import React, { useState, useEffect } from 'react';
import { Play, Search, SlidersHorizontal, Heart, Bookmark, Plus, Info } from 'lucide-react';
import { IMAGE_BASE_URL, IMAGE_BASE_URL_W500, fetchTrailer, resolveLogo, getCachedLogo } from '../api/tmdb';

interface HeroProps {
  items: any[];
}

export default function Hero({ items }: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [canShowTrailer, setCanShowTrailer] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (items && items[activeIndex]) {
      setLogoUrl(getCachedLogo(items[activeIndex]));
    }
  }, [items, activeIndex]);

  useEffect(() => {
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 30000);
    return () => clearInterval(timer);
  }, [items, activeIndex]);

  useEffect(() => {
    let isCurrent = true;
    
    // Clean up previous trailer and logo state
    setTrailerKey(null);
    setCanShowTrailer(false);

    const activeItem = items[activeIndex];
    
    const cachedLogo = getCachedLogo(activeItem);
    if (!cachedLogo) {
      setLogoUrl(null);
    }
    
    if (!activeItem) return;

    fetchTrailer(activeItem.id, activeItem.media_type || (activeItem.first_air_date ? 'tv' : 'movie'))
      .then(key => {
        if (isCurrent && key) {
          setTrailerKey(key);
        }
      });
      
    resolveLogo(activeItem).then(url => {
      if (isCurrent && url) {
        setLogoUrl(url);
      }
    });

    // Listen for YouTube postMessage API to know exactly when it starts playing
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.event === 'onStateChange' && data.info === 1) {
          if (isCurrent) setCanShowTrailer(true);
        }
      } catch (e) {
        // ignore parse errors from other extensions/scripts
      }
    };
    window.addEventListener('message', handleMessage);

    // Fallback: if we never get the playing event, reveal after 8 seconds anyway
    const timer = setTimeout(() => {
      if (isCurrent) setCanShowTrailer(true);
    }, 8000);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    };
  }, [activeIndex, items]);

  useEffect(() => {
    if (!trailerKey) return;
    let playerInitTimer: ReturnType<typeof setTimeout>;
    
    const initPlayer = () => {
      const yt = (window as any).YT;
      if (yt && yt.Player) {
        new yt.Player('hero-trailer-player', {
          events: {
            onReady: (event: any) => {
              event.target.unloadModule('captions');
            },
            onApiChange: (event: any) => {
              event.target.unloadModule('captions');
            }
          }
        });
      } else {
        playerInitTimer = setTimeout(initPlayer, 100);
      }
    };
    
    initPlayer();

    return () => clearTimeout(playerInitTimer);
  }, [trailerKey]);

  if (!items || items.length === 0) return <div className="h-[95vh] bg-[#0b0b0b] animate-pulse" />;

  const activeItem = items[activeIndex];
  
  const isTrailerVisible = canShowTrailer && trailerKey !== null;

  return (
    <div className="relative w-full min-h-[95vh] overflow-hidden bg-[#0b0b0b] flex flex-col justify-end pb-12 pt-32">
      
      {/* Layer 0: YouTube Player */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden bg-[#0b0b0b]">
        {trailerKey && (
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh] scale-[1.15] pointer-events-none transition-opacity duration-700 ease-in-out will-change-opacity ${isTrailerVisible ? 'opacity-100' : 'opacity-0'}`}>
            <iframe
              id="hero-trailer-player"
              key={trailerKey}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&loop=1&playlist=${trailerKey}&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${window.location.origin}&cc_load_policy=0`}
              className="w-full h-full pointer-events-none object-cover"
              allow="autoplay; encrypted-media"
              tabIndex={-1}
            />
          </div>
        )}
      </div>

      {/* Layer 1: Static Backdrop Images */}
      <div className="absolute inset-0 w-full h-full z-10 pointer-events-none">
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          const isVisible = isActive && !isTrailerVisible;
          return (
            <img 
              key={`base-${item.id}`}
              src={`${IMAGE_BASE_URL}${item.backdrop_path}`} 
              alt={item.title || item.name} 
              className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            />
          );
        })}
      </div>

      {/* Layer 2: Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b] via-[#0b0b0b]/80 to-transparent w-full md:w-[65%] z-20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/40 to-[#0b0b0b]/0 h-[60%] bottom-0 top-auto w-full z-20 pointer-events-none" />

      {/* Layer 3: Left Content Area */}
      <div className="relative w-full flex flex-col gap-6 z-30 mb-2">
        <div key={activeItem.id} className="animate-fade-in flex flex-col gap-5 px-12 md:w-[60%]">
          
          {/* Title / Logo */}
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={activeItem.title || activeItem.name} 
              className="h-24 md:h-36 object-contain object-left max-w-[500px]"
              loading="lazy"
            />
          ) : (
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-none uppercase">
              {activeItem.title || activeItem.name}
            </h1>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-4 mt-2">
            <button className="bg-white text-black px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition hover:bg-gray-200 shadow-lg">
              <Play className="w-4 h-4 fill-current text-black" /> Watch now
            </button>
            <button className="bg-transparent border border-white/40 hover:border-white text-white px-8 py-2.5 rounded-full font-medium flex items-center gap-2 transition backdrop-blur-sm">
              <Info className="w-5 h-5" /> Info
            </button>
          </div>

        </div>

        {/* Thumbnail Strip */}
        <div className="flex gap-3 mt-4 py-1 overflow-x-auto scrollbar-hide w-full">
          <div className="w-9 shrink-0" />
          {items.map((item, idx) => (
            <div key={item.id} className="flex flex-col gap-3 cursor-pointer shrink-0" onClick={() => setActiveIndex(idx)}>
              <div className={`w-[70px] h-[105px] rounded-md overflow-hidden transition-all duration-300 ${idx === activeIndex ? 'ring-1 ring-white opacity-100' : 'opacity-40 hover:opacity-100'}`}>
                <img 
                  src={`${IMAGE_BASE_URL_W500}${item.poster_path}`} 
                  alt={item.title || item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Progress Line */}
              <div className="h-[2px] w-full bg-white/20 rounded overflow-hidden">
                {idx === activeIndex && (
                  <div className="h-full bg-white w-full animate-progress" style={{ animationDuration: '30s' }} />
                )}
                {idx < activeIndex && (
                  <div className="h-full bg-white w-full" />
                )}
              </div>
            </div>
          ))}
          <div className="w-9 shrink-0" />
        </div>
      </div>

      {/* Floating Action Icons (Bottom Right) */}
      <div className="absolute bottom-12 right-12 z-40 hidden md:flex items-center gap-4">
        <button className="w-12 h-12 rounded-full border border-white/20 bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition group">
          <Heart className="w-5 h-5 text-white/80 group-hover:text-white transition" />
        </button>
        <button className="w-12 h-12 rounded-full border border-white/20 bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition group">
          <Bookmark className="w-5 h-5 text-white/80 group-hover:text-white transition" />
        </button>
        <button className="w-12 h-12 rounded-full border border-white/20 bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition group">
          <Plus className="w-5 h-5 text-white/80 group-hover:text-white transition" />
        </button>
      </div>
    </div>
  );
}
