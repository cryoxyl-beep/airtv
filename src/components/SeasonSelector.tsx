import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SeasonSelectorProps {
  seasons: any[];
  currentSeason: number;
  onSeasonChange: (seasonNumber: number) => void;
}

export default function SeasonSelector({ seasons, currentSeason, onSeasonChange }: SeasonSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (seasonNumber: number) => {
    onSeasonChange(seasonNumber);
    setIsOpen(false);
  };

  const selectedSeason = seasons.find(s => s.season_number === currentSeason);
  const displayName = selectedSeason ? selectedSeason.name : `Season ${currentSeason}`;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white px-5 py-3 rounded-md font-bold text-lg transition-colors border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {/* Mocking the little bag icon from reference conceptually with just clean text */}
        <span>{displayName}</span>
        <ChevronDown size={20} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 max-h-96 overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-md shadow-2xl z-50 py-2">
          {seasons.map((season) => (
            <button
              key={season.id}
              onClick={() => handleSelect(season.season_number)}
              className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-white/10 transition-colors"
            >
              <span className={`font-medium ${season.season_number === currentSeason ? 'text-white' : 'text-white/70'}`}>
                {season.name}
              </span>
              {season.season_number === currentSeason && (
                <Check size={18} className="text-white" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
