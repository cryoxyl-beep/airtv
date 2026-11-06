import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Tv, Film, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Custom Anime icon accurately matching the Binger anime spiral symbol
const AnimeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 9 9" />
    <path d="M12 7a5 5 0 0 1 5 5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

// Miyoro Star Brand Emblem matching Binger visual reference
const BrandStar = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2L14.2 9.4L21.6 11.6L14.2 13.8L12 21.2L9.8 13.8L2.4 11.6L9.8 9.4L12 2Z" />
  </svg>
);

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  // Hide sidebar on landing splash page and full-screen immersive video player pages (/play/...)
  const isHidden = location.pathname === '/' || location.pathname.startsWith('/play/');
  if (isHidden) return null;

  // Exact 6 navigation items in required order: Home, Search, TV, Anime, Movies, My Space
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      path: '/home',
      isActive: location.pathname === '/home' || location.pathname === '/',
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      path: '/search',
      isActive: location.pathname === '/search',
    },
    {
      id: 'tv',
      label: 'TV',
      icon: Tv,
      path: '/shows',
      isActive: location.pathname === '/shows',
    },
    {
      id: 'anime',
      label: 'Anime',
      icon: AnimeIcon,
      path: '/anime',
      isActive: location.pathname === '/anime' || (location.pathname.startsWith('/anime/') && !location.pathname.includes('/play/')),
    },
    {
      id: 'movies',
      label: 'Movies',
      icon: Film,
      path: '/movies',
      isActive: location.pathname === '/movies',
    },
    {
      id: 'myspace',
      label: 'My Space',
      icon: User,
      path: '/myspace',
      isActive: location.pathname === '/myspace',
      isAvatar: Boolean(currentUser?.photoURL),
    },
  ];

  const handleNavClick = (path: string) => {
    if (path === '/home' && (location.pathname === '/home' || location.pathname === '/')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(path);
    }
    // Auto collapse on click
    setIsExpanded(false);
  };

  return (
    <>
      {/* ============================================================== */}
      {/* DESKTOP COLLAPSIBLE SIDEBAR                                    */}
      {/* ============================================================== */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-[120] flex-col justify-between select-none transition-all duration-300 ease-in-out ${
          isExpanded
            ? 'w-60 bg-[#0c0c0c]/95 border-r border-white/10 shadow-[8px_0_36px_rgba(0,0,0,0.85)] backdrop-blur-2xl'
            : 'w-16 md:w-[72px] bg-black/60 hover:bg-[#0c0c0c]/80 border-r border-white/5 backdrop-blur-xl'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Top: Miyoro Brand Logo */}
        <div className="pt-6 pb-4 px-4 flex items-center">
          <button
            type="button"
            onClick={() => handleNavClick('/home')}
            className="flex items-center gap-3.5 group cursor-pointer focus:outline-none w-full"
            aria-label="Miyoro Home"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center text-white transition-all shrink-0">
              <BrandStar className="w-5 h-5 text-white transition-transform group-hover:rotate-12 duration-300" />
            </div>
            
            {/* Expanded brand text */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
              isExpanded ? 'opacity-100 max-w-[140px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
            }`}>
              <span className="text-xl font-black lowercase tracking-tight text-[#d4d4d4] group-hover:text-white transition-colors">
                miyoro
              </span>
            </div>
          </button>
        </div>

        {/* Center: Primary Navigation Items */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-1.5 justify-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative group/item flex items-center">
                {/* Active Indicator Bar on Far Left */}
                {item.isActive && (
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}

                <button
                  type="button"
                  onClick={() => handleNavClick(item.path)}
                  className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    item.isActive
                      ? 'bg-white/15 text-white font-semibold shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/10 font-medium'
                  }`}
                  aria-label={item.label}
                >
                  {/* Icon */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {item.id === 'myspace' && currentUser?.photoURL ? (
                      <img 
                        src={currentUser.photoURL} 
                        alt="Profile" 
                        className={`w-5 h-5 rounded-full object-cover border ${item.isActive ? 'border-white' : 'border-white/40'}`} 
                      />
                    ) : (
                      <Icon className={`w-5 h-5 transition-transform duration-200 ${item.isActive ? 'scale-105' : 'group-hover/item:scale-105'}`} />
                    )}
                  </div>

                  {/* Label (Expanded State Only) */}
                  <div className={`overflow-hidden transition-all duration-300 ease-out ${
                    isExpanded ? 'opacity-100 max-w-[140px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                  }`}>
                    <span className="text-sm tracking-wide whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </button>

                {/* Tooltip for Collapsed State */}
                {!isExpanded && (
                  <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#1a1a1a] border border-white/15 text-white text-xs font-semibold rounded-md shadow-2xl whitespace-nowrap opacity-0 group-hover/item:opacity-100 pointer-events-none transition-opacity duration-200 z-[130]">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Spacing */}
        <div className="pb-6 px-3" />
      </aside>

      {/* ============================================================== */}
      {/* MOBILE COMPACT BOTTOM NAVIGATION                               */}
      {/* ============================================================== */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0a0a0a]/95 backdrop-blur-2xl border-t border-white/10 z-[120] flex items-center justify-around px-2 select-none"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={`mob-${item.id}`}
              type="button"
              onClick={() => handleNavClick(item.path)}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                item.isActive ? 'text-white font-semibold' : 'text-white/50 hover:text-white'
              }`}
            >
              <div className="relative">
                {item.id === 'myspace' && currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
                {item.isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
