const fs = require('fs');

const content = `import React, { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

type FilterType = 'all' | 'movies' | 'series' | 'anime';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [isVisible, setIsVisible] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  
  useEffect(() => {
    if (location.pathname === '/search') {
      setInputValue(searchParams.get('q') || '');
      setFilter((searchParams.get('filter') as FilterType) || 'all');
    }
  }, [location.pathname, searchParams]);

  useEffect(() => {
    const handleScroll = () => {
      // Hide when scrolled past the hero section
      if (window.scrollY > 0) {
        setIsVisible(false);
        setIsFilterOpen(false); // Close filter on scroll
      } else {
        setIsVisible(true);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const isImmersive = location.pathname.startsWith('/watch/') || location.pathname.startsWith('/anime/');
  
  if (isImmersive) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setIsFilterOpen(false);
      navigate(\`/search?q=\${encodeURIComponent(inputValue.trim())}&filter=\${filter}\`);
    }
  };

  const FilterButton = ({ type, label }: { type: FilterType, label: string }) => (
    <button
      type="button"
      onClick={() => setFilter(type)}
      className={\`px-5 py-2 rounded-full text-sm font-medium transition-all \${
        filter === type 
          ? 'bg-white text-black' 
          : 'bg-[#1A1A1A] border border-white/20 text-white hover:bg-white/10'
      }\`}
    >
      {label}
    </button>
  );

  return (
    <div 
      className={\`fixed top-0 left-0 w-full z-[100] px-8 md:px-12 py-6 flex justify-between items-start pointer-events-none transition-transform duration-500 ease-in-out \${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }\`}
    >
      <div className="flex-1" />
      
      <div className="pointer-events-auto flex justify-end w-full md:w-auto">
        <form 
          onSubmit={handleSubmit}
          className={\`relative bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 ease-in-out \${isFilterOpen ? 'rounded-2xl' : 'rounded-full'} focus-within:bg-[#252525]/90 focus-within:border-white/30 w-full sm:w-[450px] lg:w-[500px] overflow-hidden hover:shadow-2xl\`}
        >
          <div className="relative flex items-center h-12 md:h-14">
            <Search className="absolute left-5 w-5 h-5 text-white/50 pointer-events-none" />
            <input 
              type="text"
              name="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search movies, tv, and anime..."
              className="w-full h-full bg-transparent pl-14 pr-[160px] md:pr-[200px] text-base text-white outline-none placeholder:text-white/50 cursor-text"
              autoComplete="off"
            />
            <div className="absolute right-3 flex items-center gap-1.5 md:gap-2">
              {inputValue && (
                <button 
                  type="button"
                  onClick={() => setInputValue('')}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={\`flex items-center justify-center h-8 md:h-9 px-3 md:px-4 rounded-full text-xs md:text-sm font-medium transition-colors border \${isFilterOpen ? 'bg-white text-black border-white' : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20 hover:text-white'}\`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <div className="hidden md:flex items-center justify-center h-8 px-2.5 rounded bg-white/10 text-xs font-semibold text-white/50 border border-white/10 select-none pointer-events-none">
                <span className="mr-0.5 text-[13px] leading-none">⌘</span>K
              </div>
            </div>
          </div>
          
          <div className={\`transition-all duration-300 ease-in-out overflow-hidden bg-black/20 \${isFilterOpen ? 'max-h-32 opacity-100 border-t border-white/10' : 'max-h-0 opacity-0'}\`}>
            <div className="px-5 py-4 flex flex-wrap gap-2.5">
              <FilterButton type="all" label="All" />
              <FilterButton type="movies" label="Movies" />
              <FilterButton type="series" label="Series" />
              <FilterButton type="anime" label="Anime" />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/Navbar.tsx', content, 'utf8');
