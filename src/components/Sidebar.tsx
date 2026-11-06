import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, Search, Tv, Disc, Film, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
      icon: House,
      path: '/home',
      isActive: location.pathname === '/home',
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
      icon: Disc,
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
      icon: UserRound,
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
    // Auto collapse on navigation
    setIsExpanded(false);
  };

  return (
    <>
      {/* ============================================================== */}
      {/* DESKTOP COLLAPSIBLE SIDEBAR                                    */}
      {/* Width: 80px (collapsed) -> 230px (expanded)                   */}
      {/* Note: Logo is not included inside the sidebar; logo belongs     */}
      {/* to the primary page header (pre-existing Miyoro branding).      */}
      {/* ============================================================== */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-[120] flex-col justify-center select-none transition-all duration-300 ease-in-out ${
          isExpanded
            ? 'w-[230px] bg-[#0c0c0c]/95 border-r border-white/10 shadow-[12px_0_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl'
            : 'w-[80px] bg-black/60 hover:bg-[#0c0c0c]/80 border-r border-white/5 backdrop-blur-xl'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Navigation Items (Centered vertically in the rail) */}
        <nav className="w-full flex flex-col gap-2 py-6 relative">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative group/item w-full flex items-center">
                {/* Active Indicator Bar on Far Left */}
                {item.isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" />
                )}

                <button
                  type="button"
                  onClick={() => handleNavClick(item.path)}
                  className={`w-full flex items-center h-12 transition-colors duration-200 cursor-pointer text-left ${
                    item.isActive
                      ? 'text-white font-semibold'
                      : 'text-white/50 hover:text-white font-medium'
                  }`}
                  aria-label={item.label}
                >
                  {/* Fixed 80px Icon Wrapper so icons never shift horizontally */}
                  <div className="w-[80px] h-12 flex items-center justify-center shrink-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        item.isActive
                          ? 'bg-white/15 text-white'
                          : 'group-hover/item:bg-white/10 group-hover/item:text-white'
                      }`}
                    >
                      {item.id === 'myspace' && currentUser?.photoURL ? (
                        <img
                          src={currentUser.photoURL}
                          alt="Profile"
                          className={`w-[22px] h-[22px] rounded-full object-cover border ${
                            item.isActive ? 'border-white' : 'border-white/40'
                          }`}
                        />
                      ) : (
                        <Icon
                          className="w-[22px] h-[22px] transition-transform duration-200 group-hover/item:scale-105"
                          strokeWidth={2}
                        />
                      )}
                    </div>
                  </div>

                  {/* Label (Fades and slides smoothly in expanded state) */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out pr-4 ${
                      isExpanded
                        ? 'opacity-100 max-w-[140px] translate-x-0'
                        : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                    }`}
                  >
                    <span className="text-sm tracking-wide whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </button>

                {/* Tooltip for Collapsed State */}
                {!isExpanded && (
                  <div className="absolute left-[84px] px-2.5 py-1 bg-[#1a1a1a]/95 border border-white/15 text-white text-xs font-semibold rounded-md shadow-2xl whitespace-nowrap opacity-0 group-hover/item:opacity-100 pointer-events-none transition-opacity duration-200 z-[130]">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
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
                  <img
                    src={currentUser.photoURL}
                    alt="Profile"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <Icon className="w-5 h-5" strokeWidth={2} />
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
