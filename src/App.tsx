import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Home from './pages/Home';
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

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isImmersive = location.pathname === '/' || location.pathname.startsWith('/play/');
  const isWatchRoute =
    location.pathname.startsWith('/watch/') ||
    (location.pathname.startsWith('/anime/') && !location.pathname.includes('/play/'));

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      <Sidebar />
      <div
        className={`flex-1 min-w-0 ${
          !isImmersive
            ? `${isWatchRoute ? 'md:pl-0' : 'md:pl-[88px]'} pb-16 md:pb-0`
            : 'p-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function NotFoundRoute() {
  const navigate = useNavigate();
  return <NotFound onHome={() => navigate('/home')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollManager />
        <GlobalShortcuts />
        <AppLayout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/shows" element={<Home typeFilter="shows" />} />
            <Route path="/anime" element={<Home typeFilter="anime" />} />
            <Route path="/movies" element={<Home typeFilter="movies" />} />
            <Route path="/sports" element={<Home typeFilter="sports" />} />
            <Route path="/sparks" element={<Home typeFilter="sparks" />} />
            <Route path="/categories" element={<Home typeFilter="categories" />} />
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
