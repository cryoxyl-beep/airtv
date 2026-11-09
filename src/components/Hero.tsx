import React, { useState, useEffect } from 'react';
import { Play, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGE_BASE_URL, fetchTrailer, resolveLogo, getCachedLogo, preloadLogosForItems } from '../api/tmdb';
import HeroSkeleton from './HeroSkeleton';
import {
  AmbientColor,
  DEFAULT_AMBIENT_COLOR,
  getHeroAmbientCacheKey,
  getCachedAmbientColor,
  extractHeroAmbientColor,
  buildAmbientBackgroundStyle,
} from '../utils/ambientColor';

interface HeroProps {
  items: any[];
  isActive?: boolean;
}

export default function Hero({ items, isActive = true }: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [canShowTrailer, setCanShowTrailer] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(() => (items && items[0] ? getCachedLogo(items[0]) : null));
  const [ambientColors, setAmbientColors] = useState<Record<string, AmbientColor>>(() => {
    const initial: Record<string, AmbientColor> = {};
    if (Array.isArray(items)) {
      for (const item of items) {
        const cached = getCachedAmbientColor(item);
        if (cached) {
          initial[getHeroAmbientCacheKey(item)] = cached;
        }
      }
    }
    return initial;
  });
  const navigate = useNavigate();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!items || items.length === 0) return;
    preloadLogosForItems(items);

    let isMounted = true;

    // Immediately populate any already-cached ambient colors
    setAmbientColors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        const key = getHeroAmbientCacheKey(item);
        const cached = getCachedAmbientColor(item);
        if (cached && !next[key]) {
          next[key] = cached;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // Prepare ambient colors for all hero entries from their static artwork
    const orderedIndices = items.map((_, i) => (activeIndex + i) % items.length);
    for (const idx of orderedIndices) {
      const item = items[idx];
      if (!item) continue;
      const key = getHeroAmbientCacheKey(item);
      if (getCachedAmbientColor(item)) continue;

      extractHeroAmbientColor(item).then((extracted) => {
        if (!isMounted) return;
        setAmbientColors((prev) => {
          if (prev[key] === extracted) return prev;
          return { ...prev, [key]: extracted };
        });
      });
    }

    return () => {
      isMounted = false;
    };
  }, [items]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

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
    if (!isActive || !items || items.length === 0) return;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 30000);
    return () => clearInterval(timer);
  }, [items, activeIndex, isActive]);

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

    resolveLogo(activeItem).then(url => {
      if (isCurrent && url) {
        setLogoUrl(url);
      }
    });

    if (!isActive) {
      return () => {
        isCurrent = false;
      };
    }

    const fetchT = activeItem.source === 'anilist' 
      ? Promise.resolve(activeItem.trailer)
      : fetchTrailer(activeItem.id, activeItem.media_type || (activeItem.first_air_date ? 'tv' : 'movie'));
    
    fetchT.then(key => {
      if (isCurrent && key) {
        setTrailerKey(key);
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
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        iframeRef.current.src = 'about:blank';
      }
    };
  }, [activeIndex, items, isActive]);

  useEffect(() => {
    if (!trailerKey) return;
    let playerInitTimer: ReturnType<typeof setTimeout>;
    let player: any = null;
    
    const initPlayer = () => {
      const yt = (window as any).YT;
      if (yt && yt.Player) {
        player = new yt.Player('hero-trailer-player', {
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

    return () => {
      clearTimeout(playerInitTimer);
      if (player && typeof player.destroy === "function") {
        player.destroy();
      }
    };
  }, [trailerKey]);

  if (!items || items.length === 0) return <HeroSkeleton />;

  const activeItem = items[activeIndex];
  if (!activeItem) return <HeroSkeleton />;

  const isTrailerVisible = canShowTrailer && trailerKey !== null;

  // Extract clean metadata
  const getMetadata = (item: any): string[] => {
    const list: string[] = [];

    // 1. Media Type
    if (item.source === 'anilist') {
      list.push('Anime');
    } else if (item.media_type === 'tv' || item.first_air_date || item.number_of_seasons) {
      list.push('Series');
    } else if (item.media_type === 'movie' || item.release_date) {
      list.push('Movie');
    } else {
      list.push('Series');
    }

    // 2. Primary Genre
    if (Array.isArray(item.genres) && item.genres.length > 0) {
      const g = item.genres[0];
      const gName = typeof g === 'string' ? g : g?.name;
      if (gName) list.push(gName);
    } else if (Array.isArray(item.genre_ids) && item.genre_ids.length > 0) {
      const genreMap: Record<number, string> = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
        99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
        27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
        10759: 'Action & Adventure', 10762: 'Kids', 10765: 'Sci-Fi & Fantasy'
      };
      const found = genreMap[item.genre_ids[0]];
      if (found) list.push(found);
    }

    // 3. Release Year
    const year = item.startDate?.year || (item.release_date || item.first_air_date)?.slice(0, 4) || item.year;
    if (year) list.push(String(year));

    // 4. Seasons or Episodes
    if (item.number_of_seasons) {
      list.push(`${item.number_of_seasons} ${item.number_of_seasons === 1 ? 'Season' : 'Seasons'}`);
    } else if (item.episodes) {
      list.push(`${item.episodes} ${item.episodes === 1 ? 'Episode' : 'Episodes'}`);
    }

    // 5. Content Rating (if available from official TMDB content_ratings or release_dates)
    let rating: string | null = null;
    if (item.content_ratings?.results && Array.isArray(item.content_ratings.results)) {
      const match = item.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US' || r.iso_3166_1 === 'IN' || r.iso_3166_1 === 'GB');
      if (match?.rating) rating = match.rating;
    }
    if (!rating && item.release_dates?.results && Array.isArray(item.release_dates.results)) {
      const usRel = item.release_dates.results.find((r: any) => r.iso_3166_1 === 'US' || r.iso_3166_1 === 'GB');
      const cert = usRel?.release_dates?.find((d: any) => d.certification)?.certification;
      if (cert) rating = cert;
    }
    if (!rating && item.certification) {
      rating = item.certification;
    }
    if (rating) {
      list.push(rating);
    }

    return list;
  };

  const metadataItems = getMetadata(activeItem);

  // Description / Overview
  const rawDescription = activeItem.overview || activeItem.description || '';
  const description = rawDescription.replace(/<[^>]+>/g, '').trim();

  // Title fallback
  const activeTitle = activeItem.title?.english || activeItem.title?.romaji || activeItem.title || activeItem.name || '';

  const handlePlay = () => {
    if (activeItem.source === 'anilist') {
      navigate(`/play/anime/${activeItem.id}/1`);
    } else {
      const type = activeItem.media_type || (activeItem.first_air_date ? 'tv' : 'movie');
      if (type === 'tv') {
        navigate(`/play/tv/${activeItem.id}/1/1`);
      } else {
        navigate(`/play/movie/${activeItem.id}`);
      }
    }
  };

  const handleMoreInfo = () => {
    if (activeItem.source === 'anilist') {
      navigate(`/anime/${activeItem.id}`);
    } else {
      const type = activeItem.media_type || (activeItem.first_air_date ? 'tv' : 'movie');
      if (type === 'tv') {
        navigate(`/watch/tv/${activeItem.id}`);
      } else {
        navigate(`/watch/movie/${activeItem.id}`);
      }
    }
  };

  const activeAmbientColor =
    ambientColors[getHeroAmbientCacheKey(activeItem)] ||
    getCachedAmbientColor(activeItem) ||
    DEFAULT_AMBIENT_COLOR;

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-[56px] pt-4 sm:pt-6 md:pt-[28px] select-none">
      {/* Dedicated Dynamic Ambient Backlighting Layer (Behind Hero, Sidebar & Top Viewport) */}
      <div
        className="pointer-events-none select-none absolute -top-16 -left-[120px] -right-8 -bottom-32 z-0"
        aria-hidden="true"
      >
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          const key = getHeroAmbientCacheKey(item);
          const itemColor =
            ambientColors[key] || getCachedAmbientColor(item) || DEFAULT_AMBIENT_COLOR;
          return (
            <div
              key={`ambient-${key}-${idx}`}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out will-change-opacity ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: buildAmbientBackgroundStyle(itemColor),
              }}
            />
          );
        })}
        {/* Smooth Vertical Fade-to-Black Mask so the ambient glow dissolves naturally into Miyoro's black background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.26) 56%, rgba(0,0,0,0.76) 82%, #000000 100%)',
          }}
        />
      </div>

      {/* Inset Rounded Hero Container */}
      <div
        className="relative z-10 w-full h-[70vh] sm:h-[76vh] md:h-[80vh] min-h-[520px] md:min-h-[600px] max-h-[840px] rounded-[18px] sm:rounded-[22px] md:rounded-[24px] overflow-hidden bg-[#0a0a0a] border border-white/10 transition-shadow duration-1000 ease-in-out isolate [transform:translateZ(0)] flex flex-col justify-end p-6 sm:p-10 md:p-12 lg:p-14"
        style={{
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.85), 0 -10px 72px -12px rgba(${activeAmbientColor.cssRgb}, 0.34), 0 0 110px -20px rgba(${activeAmbientColor.cssRgb}, 0.22)`,
        }}
      >
        
        {/* Layer 0: YouTube Player (Strictly clipped inside rounded hero container) */}
        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden rounded-[inherit] bg-black">
          {trailerKey && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh] scale-[1.12] pointer-events-none transition-opacity duration-700 ease-in-out will-change-opacity ${isTrailerVisible ? 'opacity-100' : 'opacity-0'}`}>
              <iframe
                ref={iframeRef}
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

        {/* Layer 1: Static Backdrop Images (Strictly clipped inside rounded hero container) */}
        <div className="absolute inset-0 w-full h-full z-10 pointer-events-none overflow-hidden rounded-[inherit]">
          {items.map((item, idx) => {
            const isActive = idx === activeIndex;
            const isVisible = isActive && !isTrailerVisible;
            return (
              <img 
                key={`base-${item.id}`}
                src={(item.backdrop_path?.startsWith('http') ? item.backdrop_path : `${IMAGE_BASE_URL}${item.backdrop_path}`)} 
                alt={item.title || item.name} 
                loading={idx <= 2 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={isActive ? "high" : "auto"}
                className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
              />
            );
          })}
        </div>

        {/* Layer 2: Single Left-to-Right Gradient & Subtle Bottom Blend */}
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/80 via-black/30 via-35% to-transparent to-65% z-20 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-20 sm:h-24 bg-gradient-to-t from-black/50 to-transparent z-20 pointer-events-none" />

        {/* Layer 3: Left-Aligned Hero Content Hierarchy */}
        <div className="relative w-full z-30 flex flex-col justify-end">
          
          {/* Left Information Stack: Logo -> Metadata -> Description -> Buttons */}
          <div key={activeItem.id} className="animate-fade-in flex flex-col space-y-3.5 sm:space-y-4 max-w-md sm:max-w-lg md:max-w-xl transition-all duration-700 ease-in-out">
            
            {/* 1. HD Clear Logo (Middle/Lower-Middle Left, Preserve Aspect Ratio & Fallback) */}
            {logoUrl ? (
              <div className={`flex items-end transition-all duration-700 ease-in-out origin-bottom-left ${
                isTrailerVisible 
                  ? 'h-14 sm:h-20 md:h-24 lg:h-28 scale-[0.92]' 
                  : 'h-16 sm:h-24 md:h-32 lg:h-36 scale-100'
              }`}>
                <img 
                  src={logoUrl} 
                  alt={activeTitle} 
                  className="max-h-full max-w-[240px] sm:max-w-[340px] md:max-w-[420px] object-contain object-left select-none filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] transition-all duration-700 ease-in-out"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            ) : (
              <h1 className={`font-black text-white tracking-tight uppercase leading-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)] transition-all duration-700 ease-in-out origin-bottom-left ${
                isTrailerVisible 
                  ? 'text-2xl sm:text-4xl md:text-5xl scale-[0.92]' 
                  : 'text-3xl sm:text-5xl md:text-6xl scale-100'
              }`}>
                {activeTitle}
              </h1>
            )}

            {/* 2. Metadata Row Immediately Below Logo (Unboxed Text with Bullet Separators) */}
            {metadataItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-white/90 drop-shadow-md transition-all duration-500 ease-in-out">
                {metadataItems.map((meta, i) => (
                  <React.Fragment key={i}>
                    <span>{meta}</span>
                    {i < metadataItems.length - 1 && (
                      <span className="text-white/45 select-none">•</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* 3. Description Below Metadata (Faintly fades out and collapses when trailer plays) */}
            {description && (
              <p className={`text-xs sm:text-sm md:text-[15px] text-white/85 leading-relaxed max-w-md md:max-w-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-normal transition-all duration-700 ease-in-out overflow-hidden ${
                isTrailerVisible 
                  ? 'opacity-0 max-h-0 -translate-y-2 pointer-events-none -my-1.5' 
                  : 'opacity-100 max-h-28 line-clamp-3 translate-y-0 my-0'
              }`}>
                {description}
              </p>
            )}

            {/* 4. Pill Action Buttons (Play & More Info matching Netflix reference) */}
            <div className="flex items-center gap-3 pt-1 transition-all duration-500 ease-in-out">
              <button 
                type="button"
                onClick={handlePlay}
                className="bg-white hover:bg-white/90 active:scale-95 text-black px-6 sm:px-7 py-2.5 rounded-full font-bold text-sm sm:text-base flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current text-black" />
                <span>Play</span>
              </button>
              <button 
                type="button"
                onClick={handleMoreInfo}
                className="bg-white/15 hover:bg-white/25 active:scale-95 text-white border border-white/15 px-6 sm:px-7 py-2.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2 transition-all backdrop-blur-md shadow-md cursor-pointer"
              >
                <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>More Info</span>
              </button>
            </div>

          </div>

        </div>

        {/* Hero Bottom Completion Timer Bar */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15 z-30 overflow-hidden pointer-events-none">
          <div
            key={activeIndex}
            className="h-full bg-white w-full animate-progress"
            style={{ animationDuration: '30s' }}
          />
        </div>
      </div>
    </section>
  );
}
