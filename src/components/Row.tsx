import React, { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IMAGE_BASE_URL_W500, resolveLogo, getCachedLogo, fetchDetails } from '../api/tmdb';
import { buildAnimeEpisodeList } from '../api/animeResolver';
import { dedupeItems } from '../utils/dedupe';
import RatingRing from './MiyoroRatingRing';

interface RowProps {
  title: string;
  items: any[];
  isTop10?: boolean;
}

const visibilityListeners = new Map<Element, () => void>();
let globalObserver: IntersectionObserver | null = null;

const getGlobalObserver = () => {
  if (typeof window === "undefined") return null;
  if (!globalObserver) {
    globalObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = visibilityListeners.get(entry.target);
            if (callback) {
              callback();
              globalObserver?.unobserve(entry.target);
              visibilityListeners.delete(entry.target);
            }
          }
        });
      },
      { rootMargin: "1200px" }
    );
  }
  return globalObserver;
};

const observeElement = (element: Element, callback: () => void) => {
  visibilityListeners.set(element, callback);
  getGlobalObserver()?.observe(element);
};

const unobserveElement = (element: Element) => {
  visibilityListeners.delete(element);
  getGlobalObserver()?.unobserve(element);
};

const rowScrollPositions = new Map<string, number>();

export const RowCard: React.FC<{ item: any; isTop10?: boolean; index: number; isGridCard?: boolean; hideTitleWithLogo?: boolean }> = React.memo(({ item, isTop10 = false, index, isGridCard = false, hideTitleWithLogo = false }) => {
  const initialLogo = isTop10 ? null : getCachedLogo(item);
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [loadingLogo, setLoadingLogo] = useState(!initialLogo && !isTop10);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(index < 6);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isTop10 || isVisible || logo) return;
    const el = cardRef.current;
    if (el) {
      observeElement(el, () => {
        setIsVisible(true);
      });
    }
    return () => {
      if (el) {
        unobserveElement(el);
      }
    };
  }, [isTop10, isVisible, logo]);

  useEffect(() => {
    if (isTop10) return;
    const cached = getCachedLogo(item);
    if (cached) {
      setLogo(cached);
      setLoadingLogo(false);
      return;
    }

    if (!isVisible) return;

    let mounted = true;
    setLoadingLogo(true);
    const getLogo = async () => {
      try {
        const foundLogo = await resolveLogo(item);
        if (!mounted) return;
        setLogo(foundLogo);
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
  }, [item, isVisible, isTop10]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Prefetch full metadata & episodes on hover so clicking is instant
    if (item.source === 'anilist') {
      buildAnimeEpisodeList(
        item.id,
        item.number_of_episodes || 12,
        item.anilist_raw?.streamingEpisodes,
        item.backdrop_path
      ).catch(() => {});
    } else if (item.id) {
      const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
      fetchDetails(item.id, type === 'tv' ? 'tv' : 'movie').catch(() => {});
    }
  };

  const posterImg = item.poster_path
    ? (item.poster_path.startsWith('http') ? item.poster_path : `${IMAGE_BASE_URL_W500}${item.poster_path}`)
    : (item.backdrop_path?.startsWith('http') ? item.backdrop_path : `${IMAGE_BASE_URL_W500}${item.backdrop_path}`);

  const backdropImg = item.backdrop_path
    ? (item.backdrop_path.startsWith('http') ? item.backdrop_path : `${IMAGE_BASE_URL_W500}${item.backdrop_path}`)
    : posterImg;

  const currentImg = isTop10 ? posterImg : backdropImg;

  return (
    <div
      ref={cardRef}
      className={`relative z-10 flex-shrink-0 cursor-pointer flex items-center group transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-105 ${
        isTop10 ? 'gap-0' : isGridCard ? 'w-full' : 'w-[300px] md:w-[400px] lg:w-[450px]'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (item.source === 'anilist') {
          navigate(`/anime/${item.id}`, { state: { item } });
        } else {
          const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
          if (type === 'tv') {
            navigate(`/watch/tv/${item.id}`, { state: { item } });
          } else {
            navigate(`/watch/movie/${item.id}`, { state: { item } });
          }
        }
      }}
    >
      {isTop10 && (
        <div className="flex-shrink-0 flex items-center justify-center z-10 select-none">
          <span
            className="text-[95px] sm:text-[115px] md:text-[130px] lg:text-[145px] font-sans font-black leading-none pointer-events-none select-none tracking-tighter transition-all duration-300"
            style={{
              WebkitTextStroke: isHovered ? '2px rgba(255, 255, 255, 1)' : '2px rgba(255, 255, 255, 0.4)',
              color: isHovered ? 'white' : 'transparent',
            }}
          >
            {(index + 1).toString().padStart(2, '0')}
          </span>
        </div>
      )}

      <div className={`relative rounded-md overflow-hidden bg-[#141414] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] group-hover:border-white/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.15)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] z-20 ${isTop10 ? 'w-[130px] sm:w-[155px] md:w-[175px] lg:w-[195px] aspect-[2/3] -ml-3 sm:-ml-4 md:-ml-6' : 'w-full aspect-video'}`}>
        <img
          src={currentImg}
          alt={item.title || item.name}
          className="w-full h-full object-cover transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] group-hover:scale-105 group-hover:brightness-105"
          loading={index < 4 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />

        <RatingRing value={item.vote_average ?? item.rating ?? (item.averageScore ? item.averageScore / 10 : null)} corner="top-right" className="z-30" />

        {/* Logo Overlay with subtle bottom gradient for readability (omitted on portrait Top 10 posters where artwork has embedded title) */}
        {!isTop10 && (
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end items-center p-4 pointer-events-none z-20">
            {loadingLogo ? (
              <div className="w-[60%] h-6 bg-white/20 animate-pulse rounded"></div>
            ) : logo ? (
              <>
                <img
                  src={logo}
                  alt={item.title || item.name}
                  className="max-h-16 md:max-h-[72px] max-w-[84%] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]"
                  draggable={false}
                  decoding="async"
                  onError={() => {
                    setLogo(null);
                  }}
                />
                {item.source === 'anilist' && !hideTitleWithLogo && (
                  <p className="text-white/80 text-[11px] font-semibold tracking-wide drop-shadow-md mt-1.5 text-center line-clamp-1">
                    {item.title || item.name}
                  </p>
                )}
              </>
            ) : (
              <h3 className="text-white font-bold text-lg drop-shadow-md text-center">
                {item.title || item.name}
              </h3>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const Row = React.memo(function Row({ title, items, isTop10 = false }: RowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const endSpacerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [renderAll, setRenderAll] = useState(isTop10);
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const uniqueItems = useMemo(() => {
    const deduped = dedupeItems(items || []);
    return deduped.filter((item) =>
      isTop10 ? Boolean(item.poster_path || item.backdrop_path) : Boolean(item.backdrop_path)
    );
  }, [items, isTop10]);

  const displayedItems = renderAll ? uniqueItems : uniqueItems.slice(0, 8);

  useEffect(() => {
    if (renderAll) return;
    const timer = setTimeout(() => {
      setRenderAll(true);
    }, 180);
    return () => clearTimeout(timer);
  }, [renderAll]);

  const updateScrollEdges = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const { scrollLeft: sl, scrollWidth, clientWidth } = el;
    setCanScrollLeft(sl > 8);

    // Measure untransformed layout right edge of the last card so CSS hover:scale-105 never inflates scrollWidth
    const lastCard = endSpacerRef.current?.previousElementSibling as HTMLElement | null;
    if (displayedItems.length < uniqueItems.length) {
      setCanScrollRight(true);
    } else if (lastCard && displayedItems.length > 0) {
      const lastCardRight = lastCard.offsetLeft + lastCard.offsetWidth;
      setCanScrollRight(sl + clientWidth < lastCardRight - 8);
    } else {
      setCanScrollRight(sl + clientWidth < scrollWidth - 8);
    }
  }, [displayedItems.length, uniqueItems.length]);

  // Restore horizontal scroll from fast in-memory map
  useLayoutEffect(() => {
    const savedX = rowScrollPositions.get(title);
    if (savedX && rowRef.current && items.length > 0) {
      rowRef.current.scrollLeft = savedX;
    }
    updateScrollEdges();
  }, [title, items.length, updateScrollEdges]);

  // Save horizontal scroll to fast in-memory map and keep edge arrow availability in sync
  useEffect(() => {
    const handleScroll = () => {
      if (!renderAll) setRenderAll(true);
      if (rowRef.current) {
        rowScrollPositions.set(title, rowRef.current.scrollLeft);
      }
      updateScrollEdges();
    };

    const node = rowRef.current;
    if (node) {
      node.addEventListener('scroll', handleScroll, { passive: true });
    }

    let resizeObserver: ResizeObserver | null = null;
    if (node && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollEdges();
      });
      resizeObserver.observe(node);
    }

    updateScrollEdges();

    return () => {
      if (node) node.removeEventListener('scroll', handleScroll);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [title, renderAll, updateScrollEdges, items.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!renderAll) setRenderAll(true);
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

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!renderAll) setRenderAll(true);
    updateScrollEdges();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cornerThreshold = Math.min(96, rect.width * 0.14);
    if (x <= cornerThreshold) {
      setHoveredEdge('left');
    } else if (x >= rect.width - cornerThreshold) {
      setHoveredEdge('right');
    } else {
      setHoveredEdge(null);
    }
  };

  const scrollByDirection = (direction: 'left' | 'right') => {
    if (!renderAll) setRenderAll(true);
    const el = rowRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.78, 320);
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  const showLeftNav = hoveredEdge === 'left' && canScrollLeft && !isDragging && displayedItems.length > 0;
  const showRightNav = hoveredEdge === 'right' && canScrollRight && !isDragging && displayedItems.length > 0;

  return (
    <div
      className="relative group/row"
      onMouseEnter={() => {
        if (!renderAll) setRenderAll(true);
      }}
      onTouchStart={() => {
        if (!renderAll) setRenderAll(true);
      }}
    >
      <div className="flex items-center justify-between pl-12 pr-12 mb-2">
        <h2 className="text-2xl font-bold text-white tracking-wide">{title}</h2>
      </div>

      <div
        className="relative"
        onMouseMove={handleTrackMouseMove}
        onMouseLeave={() => setHoveredEdge(null)}
      >
        {/* Left Edge Navigation Button (Clean edge gradient + chevron, only on left corner hover) */}
        <button
          type="button"
          aria-label={`Scroll ${title} left`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            scrollByDirection('left');
          }}
          className={`hidden md:flex group/nav items-center justify-start pl-3 sm:pl-4 absolute left-0 top-4 bottom-4 w-16 sm:w-20 z-[60] bg-gradient-to-r from-black/85 via-black/45 to-transparent text-white/90 hover:text-white transition-opacity duration-200 ease-out cursor-pointer focus:outline-none ${
            showLeftNav
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-transform duration-150 group-hover/nav:scale-110 group-active/nav:scale-95" />
        </button>

        {/* Right Edge Navigation Button (Clean edge gradient + chevron, only on right corner hover) */}
        <button
          type="button"
          aria-label={`Scroll ${title} right`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            scrollByDirection('right');
          }}
          className={`hidden md:flex group/nav items-center justify-end pr-3 sm:pr-4 absolute right-0 top-4 bottom-4 w-16 sm:w-20 z-[60] bg-gradient-to-l from-black/85 via-black/45 to-transparent text-white/90 hover:text-white transition-opacity duration-200 ease-out cursor-pointer focus:outline-none ${
            showRightNav
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-transform duration-150 group-hover/nav:scale-110 group-active/nav:scale-95" />
        </button>

        <div
          ref={rowRef}
          className={`flex items-center overflow-x-auto scrollbar-hide ${isTop10 ? 'gap-8 py-4' : 'gap-4 py-4'} ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div className={`${isTop10 ? 'w-4' : 'w-8'} shrink-0`} />
          
          {displayedItems.length === 0 ? (
            [...Array(6)].map((_, index) => (
              <div key={`skeleton-${index}`} className={`relative z-10 flex-shrink-0 flex items-center ${isTop10 ? 'gap-0' : 'w-[300px] md:w-[400px] lg:w-[450px]'}`}>
                {isTop10 && (
                  <div className="flex-shrink-0 flex items-center justify-center z-10 select-none">
                    <span className="text-[95px] sm:text-[115px] md:text-[130px] lg:text-[145px] font-sans font-black leading-none pointer-events-none select-none tracking-tighter" style={{ WebkitTextStroke: '2px rgba(255, 255, 255, 0.4)', color: 'transparent' }}>
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
                <div className={`relative rounded-md overflow-hidden bg-white/5 animate-pulse z-20 ${isTop10 ? 'w-[130px] sm:w-[155px] md:w-[175px] lg:w-[195px] aspect-[2/3] -ml-3 sm:-ml-4 md:-ml-6' : 'w-full aspect-video'}`} />
              </div>
            ))
          ) : (
            displayedItems.map((item, index) => (
              <RowCard key={`${item.id}-${item.tmdb_id || index}`} item={item} isTop10={isTop10} index={index} hideTitleWithLogo={true} />
            ))
          )}

          <div ref={endSpacerRef} className={`${isTop10 ? 'w-4' : 'w-8'} shrink-0`} />
        </div>
      </div>
    </div>
  );
});

export default Row;
