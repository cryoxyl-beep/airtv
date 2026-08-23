import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const handleScroll = () => {
      // Hide when scrolled past 50px, show when at the top
      if (window.scrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Don't show search bar on immersive pages
  const isImmersive = location.pathname.startsWith('/watch/') || location.pathname.startsWith('/anime/');
  
  if (isImmersive) return null;

  return (
    <div 
      className={`fixed top-6 right-6 md:top-8 md:right-10 z-[100] transition-all duration-500 ease-in-out ${
        isVisible 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 -translate-y-4 pointer-events-none'
      }`}
    >
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
  );
}
