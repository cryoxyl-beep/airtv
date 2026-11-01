import React from 'react';

export default function HeroSkeleton() {
  return (
    <section className="w-full px-4 sm:px-8 lg:px-[56px] pt-4 sm:pt-6 md:pt-[28px] select-none">
      <div className="relative w-full h-[70vh] sm:h-[76vh] md:h-[80vh] min-h-[520px] md:min-h-[600px] max-h-[840px] rounded-[18px] sm:rounded-[22px] md:rounded-[24px] overflow-hidden bg-[#0a0a0a] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col justify-end p-6 sm:p-10 md:p-12 lg:p-14">
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
        
        {/* Gradients */}
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-black/95 via-black/75 md:via-black/65 to-transparent w-full md:w-[65%] lg:w-[58%] z-20 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 sm:h-60 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-20 pointer-events-none" />

        {/* Content Area */}
        <div className="relative w-full z-30 flex flex-col justify-end">
          <div className="flex flex-col space-y-3.5 sm:space-y-4 max-w-md sm:max-w-lg md:max-w-xl">
            {/* Logo / Title Placeholder */}
            <div className="h-16 sm:h-24 md:h-32 w-[220px] sm:w-[320px] bg-white/10 rounded animate-pulse" />
            
            {/* Metadata Placeholder */}
            <div className="h-4 w-56 bg-white/10 rounded animate-pulse" />

            {/* Description Placeholder */}
            <div className="space-y-2">
              <div className="h-3.5 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-3.5 w-4/5 bg-white/10 rounded animate-pulse" />
            </div>

            {/* Pill Buttons Placeholder */}
            <div className="flex items-center gap-3 pt-1">
              <div className="w-28 sm:w-32 h-10 sm:h-11 bg-white/20 rounded-full animate-pulse" />
              <div className="w-32 sm:w-36 h-10 sm:h-11 bg-white/10 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Hero Bottom Completion Timer Bar Placeholder */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10 z-30 overflow-hidden" />
      </div>
    </section>
  );
}
