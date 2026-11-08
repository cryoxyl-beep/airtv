import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { logos } from '../assets/logos';

const platforms = [
  { id: 8, slug: 'netflix', name: 'Netflix', logo: logos.netflix },
  { id: 9, slug: 'prime-video', name: 'Prime Video', logo: logos.prime },
  { id: 337, slug: 'disney-plus', name: 'Disney+', logo: logos.disney },
  { id: 350, slug: 'apple-tv-plus', name: 'Apple TV+', logo: logos.apple },
  { id: 15, slug: 'hulu', name: 'Hulu', logo: logos.hulu },
  { id: 1899, slug: 'hbo-max', name: 'HBO Max', logo: logos.hbo },
  { id: 531, slug: 'paramount', name: 'Paramount+', logo: logos.paramount },
];

const PlatformRow = React.memo(function PlatformRow() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const navigate = useNavigate();

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
    <div
      className="relative group/row my-3"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '1px 180px',
      }}
    >
      <div className="flex items-center justify-center px-4 mb-2 sm:mb-3 text-center">
        <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-white/95 tracking-tight text-center">
          Browse by Platform
        </h2>
      </div>
      <div
        ref={rowRef}
        className="w-full overflow-x-auto scrollbar-hide py-3 scroll-smooth"
      >
        <div className="flex items-center justify-center min-w-max mx-auto gap-4 sm:gap-6 px-4 sm:px-8">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default PlatformRow;
