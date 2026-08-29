import React from 'react';

export default function HeroSkeleton() {
  return (
    <div className="relative w-full min-h-[95vh] overflow-hidden bg-black flex flex-col justify-end pb-12 pt-32">
      <div className="absolute inset-0 bg-white/5 animate-pulse" />
      
      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent w-full md:w-[65%] z-20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/0 h-[60%] bottom-0 top-auto w-full z-20 pointer-events-none" />

      {/* Content Area */}
      <div className="relative w-full flex flex-col gap-6 z-30 mb-2">
        <div className="flex flex-col gap-5 px-12 md:w-[60%]">
          {/* Title/Logo Placeholder */}
          <div className="h-24 md:h-36 w-[250px] md:w-[400px] bg-white/10 rounded animate-pulse" />
          
          {/* Buttons Placeholder */}
          <div className="flex items-center gap-4 mt-2">
            <div className="w-40 h-12 bg-white/10 rounded-full animate-pulse" />
            <div className="w-32 h-12 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Thumbnail Strip Placeholder */}
        <div className="flex gap-3 mt-4 py-1 overflow-x-auto scrollbar-hide w-full">
          <div className="w-9 shrink-0" />
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex flex-col gap-3 shrink-0">
              <div className="w-[70px] h-[105px] rounded-md bg-white/10 animate-pulse" />
              <div className="h-[2px] w-full bg-white/5 rounded" />
            </div>
          ))}
          <div className="w-9 shrink-0" />
        </div>
      </div>

      {/* Floating Action Icons Placeholder */}
      <div className="absolute bottom-12 right-12 z-40 hidden md:flex items-center gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
