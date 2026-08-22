import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGE_BASE_URL_W500, resolveLogo, getCachedLogo } from '../api/tmdb';

interface RowProps {
  title: string;
  items: any[];
  isTop10?: boolean;
}

const RowCard: React.FC<{ item: any; isTop10: boolean; index: number }> = ({ item, isTop10, index }) => {
  const initialLogo = getCachedLogo(item);
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [loadingLogo, setLoadingLogo] = useState(!initialLogo);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

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
    
    // If we already synchronously loaded the logo, we don't need to fetch it again
    if (logo) return;

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
  }, [item, isVisible, logo]);

  return (
    <div
      ref={cardRef}
      className={`relative z-10 flex-shrink-0 cursor-pointer flex items-center group transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-110 ${
        isTop10 ? 'gap-2 md:gap-4' : 'w-[300px] md:w-[400px] lg:w-[450px]'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        if (type === 'tv') {
          navigate(`/watch/tv/${item.id}/season/1/episode/1`);
        } else {
          navigate(`/watch/movie/${item.id}`);
        }
      }}
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

      <div className={`relative rounded-md overflow-hidden bg-[#141414] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] group-hover:border-white/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.15)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] aspect-video z-20 ${isTop10 ? 'w-[220px] md:w-[280px] lg:w-[320px] -ml-2 md:-ml-4' : 'w-full'}`}>
        <img
          src={`${IMAGE_BASE_URL_W500}${item.backdrop_path}`}
          alt={item.title || item.name}
          className="w-full h-full object-cover transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] group-hover:scale-105 group-hover:brightness-110"
          loading="lazy"
          draggable={false}
        />

        {/* Logo Overlay with subtle bottom gradient for readability */}
        <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end items-center p-4 pointer-events-none z-20">
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
