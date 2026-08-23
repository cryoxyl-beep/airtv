import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      // Hide when scrolled past the hero section (approx 90% of viewport height)
      if (window.scrollY > window.innerHeight * 0.9) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Don't show search bar on immersive pages
  const isImmersive = location.pathname.startsWith('/watch/');
  
  if (isImmersive) return null;

  return (
    <div 
      className={`fixed top-0 left-0 w-full z-[100] px-8 md:px-12 py-6 flex justify-between items-center pointer-events-none transition-transform duration-500 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex-1" />
      
      <div className="pointer-events-auto flex justify-end">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const q = e.currentTarget.search.value.trim();
            if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
          }}
          className="group flex items-center justify-end rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-500 ease-out hover:bg-[#252525]/90 focus-within:bg-[#252525]/90 w-64 md:w-[320px] h-11 md:h-12 overflow-hidden cursor-text hover:shadow-2xl"
        >
          <input 
            type="text"
            name="search"
            placeholder="Search movies & tv..."
            className="bg-transparent border-none outline-none text-white/90 placeholder:text-white/50 w-full pl-5 opacity-100 text-sm md:text-base font-medium cursor-text"
          />
          <button 
            type="submit"
            className="flex items-center justify-center shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-full cursor-pointer"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-white/90 group-hover:scale-105 transition-transform" strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
