import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  SearchIcon,
  TvIcon,
  AnimeIcon,
  MoviesIcon,
} from './MiyoroIcons';
import { preloadHomeData, markHomeRevealShown } from '../pages/Home';

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Hide sidebar on landing splash page and full-screen immersive video player pages (/play/...)
  const isHidden = location.pathname === '/' || location.pathname.startsWith('/play/');
  if (isHidden) return null;

  // Detect Movie, TV Series, and Anime watch pages for Transparent Immersive Mode
  const isWatchPage =
    location.pathname.startsWith('/watch/') ||
    (location.pathname.startsWith('/anime/') && !location.pathname.includes('/play/'));

  // Navigation icon size: slightly larger (26px) on watch pages, standard (24px) elsewhere
  const navIconSize = isWatchPage ? 26 : 24;

  // Strictly the 5 requested navigation entries (Home, Search, TV, Anime, Movies):
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: HomeIcon,
      path: '/home',
      isActive: location.pathname === '/home',
    },
    {
      id: 'search',
      label: 'Search',
      icon: SearchIcon,
      path: '/search',
      isActive: location.pathname === '/search',
    },
    {
      id: 'tv',
      label: 'TV',
      icon: TvIcon,
      path: '/shows',
      isActive: location.pathname === '/shows' || location.pathname.startsWith('/watch/tv/'),
    },
    {
      id: 'anime',
      label: 'Anime',
      icon: AnimeIcon,
      path: '/anime',
      isActive:
        location.pathname === '/anime' ||
        (location.pathname.startsWith('/anime/') && !location.pathname.includes('/play/')),
    },
    {
      id: 'movies',
      label: 'Movies',
      icon: MoviesIcon,
      path: '/movies',
      isActive: location.pathname === '/movies' || location.pathname.startsWith('/watch/movie/'),
    },
  ];

  const handleMouseEnter = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    // Also warm home data whenever the user expands the sidebar
    preloadHomeData().catch(() => {});
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
    }, 50);
  };

  const handleItemHover = (path: string) => {
    if (path === '/home') {
      preloadHomeData().catch(() => {});
    }
  };

  const handleNavClick = (path: string) => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    // Dismiss any active search input focus to eliminate keyboard dismissal delay
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Never show logo reveal overlay on in-app route transitions
    markHomeRevealShown();

    if (path === '/home' && (location.pathname === '/home' || location.pathname === '/')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(path);
    }
    setIsExpanded(false);
  };

  return (
    <>
      {/* ==================================================================== */}
      {/* LAYER B: ONE PERSISTENT, INDEPENDENT AMBIENT BACKDROP LAYER          */}
      {/* Fixed 420px wide, constant backdrop blur value, smooth opacity fade  */}
      {/* Never changes dimensions or swaps blur layers during expansion       */}
      {/* ==================================================================== */}
      <div
        aria-hidden="true"
        className={`hidden md:block fixed top-0 left-0 bottom-0 w-[420px] z-[115] pointer-events-none select-none transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity] ${
          isExpanded
            ? 'opacity-100'
            : isWatchPage
            ? 'opacity-25'
            : 'opacity-0'
        }`}
        style={{
          background: isWatchPage
            ? 'linear-gradient(90deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.22) 22%, rgba(0,0,0,0.14) 38%, rgba(0,0,0,0.06) 56%, rgba(0,0,0,0.02) 74%, rgba(0,0,0,0) 100%)'
            : 'linear-gradient(90deg, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0.16) 22%, rgba(0,0,0,0.10) 38%, rgba(0,0,0,0.04) 56%, rgba(0,0,0,0.01) 74%, rgba(0,0,0,0) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          maskImage:
            'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 36%, rgba(0,0,0,0.75) 56%, rgba(0,0,0,0.35) 76%, rgba(0,0,0,0.08) 90%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage:
            'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 36%, rgba(0,0,0,0.75) 56%, rgba(0,0,0,0.35) 76%, rgba(0,0,0,0.08) 90%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* ==================================================================== */}
      {/* LAYER A & C: INTERACTIVE NAVIGATION RAIL + STATIONARY NAV CONTENT    */}
      {/* Collapsed: 88px rail -> Expanded: 235px surface                      */}
      {/* Synchronized cubic-bezier(0.22,1,0.36,1) 300ms transition            */}
      {/* ==================================================================== */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-[120] flex-col justify-between select-none bg-transparent transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isExpanded ? 'w-[235px]' : 'w-[88px]'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Top Brand Symbol (Standalone Miyoro Symbol at Fixed Position) */}
        <div className="w-[88px] pt-8 flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={() => handleNavClick('/home')}
            onMouseEnter={() => handleItemHover('/home')}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/95 hover:text-white transition-opacity duration-200 cursor-pointer focus:outline-none"
            aria-label="Miyoro Home"
          >
            <img
              src="/miyoro-logo-white.svg"
              alt="Miyoro"
              style={{ width: navIconSize, height: navIconSize }}
              className="object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
              draggable={false}
            />
          </button>
        </div>

        {/* Layer C: Vertically Centered 5-Item Navigation Stack */}
        <nav className="w-full flex flex-col gap-3.5 my-auto py-4">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.id} className="relative w-full flex items-center">
                {/* Active Left Edge Pill Indicator */}
                <div
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    item.isActive
                      ? 'h-7 opacity-100 shadow-[0_0_10px_rgba(255,255,255,0.9)]'
                      : 'h-0 opacity-0'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => handleNavClick(item.path)}
                  onMouseEnter={() => handleItemHover(item.path)}
                  className={`group/item w-full h-11 flex items-center cursor-pointer text-left focus:outline-none transition-colors duration-200 ${
                    item.isActive
                      ? 'text-white font-semibold'
                      : isWatchPage
                      ? 'text-white/75 hover:text-white font-medium'
                      : 'text-white/55 hover:text-white font-medium'
                  }`}
                  aria-label={item.label}
                >
                  {/* Fixed 88px Rail Slot containing a 44px (w-11 h-11) Icon Container */}
                  {/* Guarantees zero horizontal or vertical icon shift during expansion */}
                  <div className="w-[88px] h-11 flex items-center justify-center shrink-0">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-200 ${
                        item.isActive
                          ? 'text-white'
                          : isWatchPage
                          ? 'text-white/75 group-hover/item:text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]'
                          : 'text-white/60 group-hover/item:text-white'
                      }`}
                    >
                      <Icon size={navIconSize} active={item.isActive} />
                    </div>
                  </div>

                  {/* Independent Label Animation synchronized with backdrop & rail */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] pr-5 ${
                      isExpanded
                        ? 'opacity-100 translate-x-0 max-w-[145px]'
                        : 'opacity-0 -translate-x-2 max-w-0 pointer-events-none'
                    }`}
                  >
                    <span
                      className={`text-[15px] leading-none tracking-[0.01em] whitespace-nowrap ${
                        item.isActive
                          ? 'text-white font-semibold'
                          : 'text-white/70 group-hover/item:text-white font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </nav>

        {/* Bottom Optical Spacer to keep the items balanced against the top logo */}
        <div className="w-[88px] h-[72px] shrink-0 pointer-events-none" />
      </aside>

      {/* ==================================================================== */}
      {/* MOBILE COMPACT BOTTOM NAVIGATION BAR                                 */}
      {/* ==================================================================== */}
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
              onTouchStart={() => handleItemHover(item.path)}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer focus:outline-none ${
                item.isActive ? 'text-white font-semibold' : 'text-white/50 hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon size={24} active={item.isActive} />
                {item.isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_4px_white]" />
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
