import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';

const platforms = [
  { id: 8, slug: 'netflix', name: 'Netflix', logo: '/netflix.png' },
  { id: 9, slug: 'prime-video', name: 'Prime Video', logo: '/prime.png' },
  { id: 337, slug: 'disney-plus', name: 'Disney+', logo: '/disney.png' },
  { id: 350, slug: 'apple-tv-plus', name: 'Apple TV+', logo: '/apple.png' },
  { id: 15, slug: 'hulu', name: 'Hulu', logo: '/hulu.png' },
  { id: 1899, slug: 'hbo-max', name: 'HBO Max', logo: '/hbo.png' },
  { id: 531, slug: 'paramount', name: 'Paramount+', logo: '/paramount.png' },
];

export default function PlatformRow() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();

  // Restore horizontal scroll
  useEffect(() => {
    if (navigationType === 'POP' && rowRef.current) {
      const savedX = sessionStorage.getItem(`scroll-x-${location.key}-platforms`);
      if (savedX) {
        const x = parseInt(savedX, 10);
        let attempts = 0;
        const interval = setInterval(() => {
          if (rowRef.current) {
            if (rowRef.current.scrollLeft !== x && rowRef.current.scrollWidth >= x) {
               rowRef.current.scrollLeft = x;
            }
            attempts++;
            if (attempts > 20 || rowRef.current.scrollLeft === x) {
               clearInterval(interval);
            }
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, [location, navigationType]);

  // Save horizontal scroll
  useEffect(() => {
    let timeoutId: any;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        if (rowRef.current) {
           sessionStorage.setItem(`scroll-x-${location.key}-platforms`, rowRef.current.scrollLeft.toString());
        }
        timeoutId = null;
      }, 200);
    };
    
    const node = rowRef.current;
    if (node) {
       node.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
       if (node) node.removeEventListener('scroll', handleScroll);
       if (timeoutId) clearTimeout(timeoutId);
    };
  }, [location]);

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
      <div className="flex items-center justify-center mb-2">
        <h2 className="text-2xl font-bold text-white tracking-wide">Browse by Platform</h2>
      </div>
      <div
        ref={rowRef}
        className={`flex items-center lg:justify-center overflow-x-auto scrollbar-hide gap-6 py-8 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div className="w-6 shrink-0" />
        
        {platforms.map((platform) => (
          <div
            key={platform.id}
            onClick={() => navigate(`/browse/${platform.slug}`)}
            className="flex-shrink-0 cursor-pointer flex flex-col items-center gap-3 group w-24 md:w-28"
          >
            <div className="w-full aspect-square rounded-2xl bg-[#1a1a1a] border border-white/5 shadow-md group-hover:bg-[#262626] group-hover:border-white/20 group-hover:-translate-y-1 group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition-all duration-300 flex items-center justify-center p-3 md:p-4">
              <img
                src={platform.logo}
                alt={platform.name}
                className="max-h-[48px] md:max-h-[56px] max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                draggable={false}
                loading="lazy"
              />
            </div>
            <span className="text-white/60 text-xs font-medium tracking-wide group-hover:text-white transition-colors text-center w-full leading-tight">
              {platform.name}
            </span>
          </div>
        ))}

        <div className="w-6 shrink-0" />
      </div>
    </div>
  );
}
