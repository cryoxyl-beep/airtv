import React, { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

type FilterType = '' | 'all' | 'movies' | 'series' | 'anime';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [isVisible, setIsVisible] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<FilterType>('');
  const [showFilterError, setShowFilterError] = useState(false);
  
  useEffect(() => {
    if (location.pathname === '/search') {
      const q = searchParams.get('q') || '';
      setInputValue(q);
      if (q) setIsExpanded(true);
      setFilter((searchParams.get('filter') as FilterType) || '');
    }
  }, [location.pathname, searchParams]);

  useEffect(() => {
    const handleFocusSearch = () => {
      setIsExpanded(true);
      setIsVisible(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        const input = document.querySelector('input[name="search"]');
        if (input) (input as HTMLElement).focus();
      }, 300);
    };
    window.addEventListener('focus-search', handleFocusSearch);
    return () => window.removeEventListener('focus-search', handleFocusSearch);
  }, []);

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
  
    useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const container = document.getElementById('search-form-container');
      if (container && !container.contains(e.target as Node)) {
        if (!inputValue) {
          setIsExpanded(false);
        }
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue]);

  const isSearchActive = isExpanded || inputValue || isFilterOpen || location.pathname === '/search';

  const isImmersive = location.pathname === '/' || location.pathname.startsWith('/watch/') || location.pathname.startsWith('/anime/') || location.pathname.startsWith('/play/');
  
  if (isImmersive) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      if (!filter) {
        setIsFilterOpen(true);
        setShowFilterError(true);
        setTimeout(() => setShowFilterError(false), 2000);
        return;
      }
      setIsFilterOpen(false);
      setShowFilterError(false);
      navigate(`/search?q=${encodeURIComponent(inputValue.trim())}&filter=${filter}`);
    }
  };

  const FilterButton = ({ type, label }: { type: FilterType, label: string }) => (
    <button
      type="button"
      onClick={() => {
        setFilter(type);
        setShowFilterError(false);
      }}
      className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
        filter === type 
          ? 'bg-white text-black' 
          : showFilterError
            ? 'bg-[#1A1A1A] border border-red-500/50 text-red-400 hover:bg-red-500/10'
            : 'bg-[#1A1A1A] border border-white/20 text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div 
      className={`fixed top-0 left-0 w-full z-[100] px-8 md:px-12 py-6 flex justify-between items-start pointer-events-none transition-transform duration-500 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex-1 pointer-events-auto flex items-center h-12 md:h-14">
        {(location.pathname === '/home' || location.pathname === '/search') && (
          <h1 
            onClick={() => {
              if (location.pathname === '/home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                navigate('/home');
              }
            }}
            className="text-[#d4d4d4] text-3xl md:text-4xl font-black lowercase tracking-tight drop-shadow-md cursor-pointer transition-transform hover:scale-105 select-none"
          >
            miyoro
          </h1>
        )}
      </div>
      
      <div id="search-form-container" className="pointer-events-auto flex justify-end w-full md:w-auto relative">
        <form 
          onSubmit={handleSubmit}
          className={`relative bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 ease-out rounded-full focus-within:bg-[#252525]/90 focus-within:border-white/30 ${isSearchActive ? 'w-full sm:w-[450px] lg:w-[500px]' : 'w-[100px] md:w-[150px]'} hover:shadow-2xl z-20`}
        >
          <div className="relative flex items-center h-12 md:h-14">
            <button 
              type="button"
              onClick={() => {
                if (!isSearchActive) {
                  setIsExpanded(true);
                  setTimeout(() => {
                    const input = document.querySelector('input[name="search"]');
                    if (input) (input as HTMLElement).focus();
                  }, 50);
                }
              }}
              className={`absolute left-5 w-5 h-5 flex items-center justify-center text-white/50 transition-colors z-30 ${!isSearchActive ? 'cursor-pointer hover:text-white pointer-events-auto' : 'pointer-events-none'}`}
            >
              <Search className="w-full h-full" />
            </button>
            <input 
              type="text"
              name="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              placeholder="Search..."
              className={`h-full bg-transparent text-base text-white outline-none placeholder:text-white/50 cursor-text transition-all duration-300 ${isSearchActive ? 'w-full pl-14 pr-[160px] md:pr-[200px] opacity-100 pointer-events-auto' : 'w-0 pl-14 pr-0 opacity-0 pointer-events-none'}`}
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
                className={`flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full text-xs md:text-sm font-medium transition-colors border ${isFilterOpen ? 'bg-white text-black border-white' : 'bg-[#1A1A1A] border-white/20 text-white hover:bg-white/10 hover:text-white shadow-sm'}`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              <div className="hidden md:flex items-center justify-center h-8 px-2.5 rounded-full bg-[#1A1A1A] text-xs font-semibold text-white/60 border border-white/20 select-none pointer-events-none shadow-sm">
                <span className="mr-0.5 text-[13px] leading-none">⌘</span>K
              </div>
            </div>
          </div>
          
        </form>
        
        {/* Floating Dropdown Filter Menu */}
        <div 
          className={`absolute top-full mt-2 right-0 w-full sm:w-[450px] lg:w-[500px] bg-[#1A1A1A]/95 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden transition-all duration-300 origin-top ${isFilterOpen ? 'opacity-100 translate-y-0 scale-y-100 pointer-events-auto' : 'opacity-0 -translate-y-2 scale-y-95 pointer-events-none'}`}
        >
          <div className="px-5 py-4 flex flex-wrap gap-2.5">
            <FilterButton type="all" label="All" />
            <FilterButton type="movies" label="Movies" />
            <FilterButton type="series" label="Series" />
            <FilterButton type="anime" label="Anime" />
          </div>
        </div>
      </div>
    </div>
  );
}
