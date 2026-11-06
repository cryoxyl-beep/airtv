import React, { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

type FilterType = '' | 'all' | 'movies' | 'series' | 'anime';

export default function Navbar() {
  const { currentUser, logout, signInWithGoogle } = useAuth();
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
      if (window.scrollY > 0) {
        setIsVisible(false);
        setIsFilterOpen(false);
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
      className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-all ${
        filter === type 
          ? 'bg-white text-black font-semibold' 
          : showFilterError
            ? 'bg-[#1A1A1A] border border-red-500/50 text-red-400 hover:bg-red-500/10'
            : 'bg-[#1A1A1A] border border-white/20 text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );

  return (
    <header 
      className="relative w-full z-[100] bg-black px-4 sm:px-8 lg:px-[56px] pt-4 sm:pt-5 pb-2 flex items-center justify-between select-none"
    >
      {/* LEFT: Miyoro Logo (Visible on mobile where sidebar is bottom navigation) */}
      <div className="flex md:hidden items-center z-10 shrink-0">
        <h1 
          onClick={() => {
            if (location.pathname === '/home' && !searchParams.get('type')) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/home');
            }
          }}
          className="text-[#d4d4d4] text-2xl sm:text-3xl font-black lowercase tracking-tight cursor-pointer transition-transform hover:scale-105 select-none"
        >
          miyoro
        </h1>
      </div>

      {/* RIGHT: Search Icon + Profile Avatar (No Bell Icon) */}
      <div className="flex items-center gap-3 sm:gap-4 z-20 shrink-0">
        <div id="search-form-container" className="flex justify-end relative items-center">
          {!isSearchActive ? (
            <button
              type="button"
              onClick={() => {
                setIsExpanded(true);
                setTimeout(() => {
                  const input = document.querySelector('input[name="search"]');
                  if (input) (input as HTMLElement).focus();
                }, 50);
              }}
              className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center text-white/85 hover:text-white hover:bg-[#252525]/90 transition-all cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          ) : (
            <form 
              onSubmit={handleSubmit}
              className="relative bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 ease-out rounded-full w-[220px] sm:w-[320px] md:w-[360px] focus-within:border-white/30 z-20"
            >
              <div className="relative flex items-center h-11 md:h-12">
                <span className="absolute left-4 w-4 h-4 flex items-center justify-center text-white/70 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text"
                  name="search"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setIsExpanded(true)}
                  placeholder="Titles, anime, genres..."
                  className="h-full w-full bg-transparent text-xs sm:text-sm text-white outline-none placeholder:text-white/45 pl-10 pr-20"
                  autoComplete="off"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {inputValue && (
                    <button 
                      type="button"
                      onClick={() => setInputValue('')}
                      className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
                      isFilterOpen ? 'bg-white text-black border-white' : 'bg-[#1f1f1f] border-white/15 text-white/80 hover:text-white'
                    }`}
                    title="Filter type"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          )}
          
          {/* Floating Dropdown Filter Menu */}
          <div 
            className={`absolute top-full mt-2 right-0 w-[260px] sm:w-[320px] bg-[#161616]/95 border border-white/15 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden transition-all duration-200 origin-top ${
              isFilterOpen ? 'opacity-100 translate-y-0 scale-y-100 pointer-events-auto' : 'opacity-0 -translate-y-2 scale-y-95 pointer-events-none'
            }`}
          >
            <div className="px-4 py-3 flex flex-wrap gap-2">
              <FilterButton type="all" label="All" />
              <FilterButton type="movies" label="Movies" />
              <FilterButton type="series" label="Series" />
              <FilterButton type="anime" label="Anime" />
            </div>
          </div>
        </div>

        {/* Profile Avatar Button on the Far Right */}
        <div className="relative group flex items-center">
          <button 
            type="button"
            onClick={() => {
              if (!currentUser) {
                signInWithGoogle().catch(() => {});
              }
            }}
            className="w-11 h-11 md:w-12 md:h-12 rounded-full overflow-hidden bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md hover:bg-[#252525]/90 transition-all cursor-pointer flex items-center justify-center text-white/85 hover:text-white focus:outline-none"
            title={currentUser ? currentUser.displayName || 'Profile' : 'Sign In'}
            aria-label="User Profile"
          >
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-white/85" />
            )}
          </button>
          {currentUser && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-[#1A1A1A]/95 border border-white/10 shadow-2xl backdrop-blur-xl rounded-xl overflow-hidden opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 origin-top-right">
              <div className="px-4 py-2.5 border-b border-white/10 text-xs text-white/50 truncate">
                {currentUser.displayName || currentUser.email}
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full px-4 py-2.5 text-left text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2.5 text-sm font-medium cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
