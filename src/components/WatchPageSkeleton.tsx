import React from 'react';

export default function WatchPageSkeleton({ type }: { type: 'movie' | 'tv' }) {
  return (
    <div className={`relative w-full bg-[#111] overflow-hidden ${type === 'movie' ? 'h-screen' : 'aspect-video md:aspect-[21/9] lg:aspect-[21/9] xl:aspect-[24/9]'}`}>
      <div className="absolute inset-0 bg-white/5 animate-pulse" />
      
      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
      
      <div className="absolute inset-0 z-10 flex flex-col justify-end px-6 pb-6 pt-16 md:px-12 md:pb-10 lg:px-16 lg:pb-12 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-12 w-full max-w-7xl mx-auto h-full">
          
          <div className="flex flex-col items-start justify-end gap-4 md:gap-5 shrink-0 md:w-5/12 lg:w-1/2 flex-1">
            {/* Logo Placeholder */}
            <div className="h-20 md:h-28 lg:h-36 w-[200px] md:w-[300px] bg-white/10 rounded animate-pulse" />
            
            {/* Buttons Placeholder */}
            <div className="flex items-center gap-3 w-full pb-1 md:pb-2 mt-2">
              <div className="w-36 h-11 md:w-44 md:h-12 bg-white/10 rounded-full animate-pulse" />
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-full animate-pulse ml-2" />
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-full animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col gap-3 md:w-7/12 lg:w-1/2 md:pb-2">
            {/* Metadata Placeholder */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-4 md:h-5 bg-white/10 rounded animate-pulse" />
              <div className="w-16 h-4 md:h-5 bg-white/10 rounded animate-pulse" />
              <div className="w-24 h-4 md:h-5 bg-white/10 rounded animate-pulse" />
            </div>
            
            {/* Description Placeholder */}
            <div className="flex flex-col gap-2 mt-2">
              <div className="w-full h-4 bg-white/10 rounded animate-pulse" />
              <div className="w-[90%] h-4 bg-white/10 rounded animate-pulse" />
              <div className="w-[75%] h-4 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
