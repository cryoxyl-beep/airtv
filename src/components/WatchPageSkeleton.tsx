import React from 'react';

export default function WatchPageSkeleton({ type }: { type: 'movie' | 'tv' }) {
  return (
    <div className="relative w-full h-screen min-h-[680px] bg-[#0b0b0b] overflow-hidden">
      <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />

      {/* Directional Left Gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 35%, transparent 75%)',
        }}
      />

      <div className="absolute inset-0 z-10 flex flex-col justify-center px-6 pt-20 pb-10 md:px-14 lg:px-20 w-full">
        <div className="flex flex-col items-start justify-center gap-3.5 max-w-[480px] w-full">
          {/* Logo Placeholder */}
          <div className="h-20 md:h-28 w-[220px] md:w-[320px] bg-white/10 rounded-lg animate-pulse mb-2" />

          {/* Metadata Row Placeholder */}
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-4 bg-white/10 rounded animate-pulse" />
            <div className="w-14 h-4 bg-white/10 rounded animate-pulse" />
            <div className="w-24 h-4 bg-white/10 rounded animate-pulse" />
            <div className="w-8 h-4 bg-white/10 rounded animate-pulse" />
          </div>

          {/* Rating & Advisories Placeholder */}
          <div className="flex items-center gap-2.5">
            <div className="w-14 h-5 bg-white/10 rounded animate-pulse" />
            <div className="w-36 h-4 bg-white/10 rounded animate-pulse" />
          </div>

          {/* Description Placeholder */}
          <div className="flex flex-col gap-2 w-full mt-1">
            <div className="w-full h-3.5 bg-white/10 rounded animate-pulse" />
            <div className="w-[92%] h-3.5 bg-white/10 rounded animate-pulse" />
            <div className="w-[75%] h-3.5 bg-white/10 rounded animate-pulse" />
          </div>

          {/* Icon Controls Placeholder */}
          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-10 h-10 bg-white/10 rounded-full animate-pulse" />
            <div className="w-10 h-10 bg-white/10 rounded-full animate-pulse" />
            <div className="w-10 h-10 bg-white/10 rounded-full animate-pulse" />
          </div>

          {/* Action Stack Placeholder */}
          <div className="flex flex-col gap-2.5 w-full max-w-[360px] pt-1">
            <div className="w-full h-12 bg-white/15 rounded-full animate-pulse" />
            <div className="w-48 h-9 bg-white/10 rounded-full animate-pulse" />
            {type === 'tv' && (
              <div className="w-40 h-9 bg-white/10 rounded-full animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
