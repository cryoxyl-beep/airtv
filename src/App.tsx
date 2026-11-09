import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Home, { preloadHomeData, markHomeRevealShown } from './pages/Home';
import WatchPage from './pages/WatchPage';
import PlayerPage from './pages/PlayerPage';
import BrowsePage from './pages/BrowsePage';
import SearchPage from './pages/SearchPage';
import MySpace from './pages/MySpace';
import NotFound from './components/MiyoroNotFound';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import Sidebar from './components/Sidebar';
import { AuthProvider } from './contexts/AuthContext';

function GlobalShortcuts() {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-search'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  return null;
}

function ScrollManager() {
  useScrollRestoration();
  return null;
}

const HOME_ROUTE_FILTERS: Record<
  string,
  'shows' | 'movies' | 'anime' | 'sports' | 'sparks' | 'categories' | undefined
> = {
  '/home': undefined,
  '/shows': 'shows',
  '/anime': 'anime',
  '/movies': 'movies',
  '/sports': 'sports',
  '/sparks': 'sparks',
  '/categories': 'categories',
};

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isImmersive = location.pathname === '/' || location.pathname.startsWith('/play/');
  const isWatchRoute =
    location.pathname.startsWith('/watch/') ||
    (location.pathname.startsWith('/anime/') && !location.pathname.includes('/play/'));

  const isHomeScreen = Object.prototype.hasOwnProperty.call(HOME_ROUTE_FILTERS, location.pathname);
  const activeTypeFilter = isHomeScreen ? HOME_ROUTE_FILTERS[location.pathname] : undefined;

  // Keep last selected home filter stable when hidden on other routes
  const lastFilterRef = React.useRef(activeTypeFilter);
  if (isHomeScreen) {
    lastFilterRef.current = activeTypeFilter;
  }

  // If user starts on a non-home internal route (like /search), mark reveal shown synchronously before mount
  if (location.pathname !== '/' && location.pathname !== '/home') {
    markHomeRevealShown();
  }

  const [mountHome, setMountHome] = React.useState(() => location.pathname !== '/');

  React.useEffect(() => {
    if (location.pathname !== '/' && !mountHome) {
      setMountHome(true);
    }
  }, [location.pathname, mountHome]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-x-hidden">
      <Sidebar />
      <div
        className={`flex-1 min-w-0 ${
          !isImmersive
            ? `${isWatchRoute ? 'md:pl-0' : 'md:pl-[88px]'} pb-16 md:pb-0`
            : 'p-0'
        }`}
      >
        {!isHomeScreen && children}
        {mountHome && (
          <Home key={lastFilterRef.current || 'home'} typeFilter={lastFilterRef.current} isActive={isHomeScreen} />
        )}
      </div>
    </div>
  );
}

function NotFoundRoute() {
  const navigate = useNavigate();
  return <NotFound onHome={() => navigate('/home')} />;
}

export default function App() {
  React.useEffect(() => {
    // Eagerly preheat Home screen data in background as soon as app boots
    preloadHomeData().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollManager />
        <GlobalShortcuts />
        <AppLayout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={null} />
            <Route path="/shows" element={null} />
            <Route path="/anime" element={null} />
            <Route path="/movies" element={null} />
            <Route path="/sports" element={null} />
            <Route path="/sparks" element={null} />
            <Route path="/categories" element={null} />
            <Route path="/myspace" element={<MySpace />} />
            <Route path="/watch/movie/:id" element={<WatchPage type="movie" />} />
            <Route path="/watch/tv/:id" element={<WatchPage type="tv" />} />
            <Route path="/watch/tv/:id/:season/:episode" element={<WatchPage type="tv" />} />
            <Route path="/anime/:id" element={<WatchPage type="anime" />} />
            <Route path="/anime/:id/:episode" element={<WatchPage type="anime" />} />
            <Route path="/play/movie/:id" element={<PlayerPage type="movie" />} />
            <Route path="/play/tv/:id/:season/:episode" element={<PlayerPage type="tv" />} />
            <Route path="/play/anime/:id/:episode" element={<PlayerPage type="anime" />} />
            <Route path="/browse/:platform" element={<BrowsePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="*" element={<NotFoundRoute />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}
