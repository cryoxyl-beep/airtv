import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Home from './pages/Home';
import WatchPage from './pages/WatchPage';
import PlayerPage from './pages/PlayerPage';
import BrowsePage from './pages/BrowsePage';
import SearchPage from './pages/SearchPage';
import MySpace from './pages/MySpace';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import Navbar from './components/Navbar';
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Sidebar />
      <div className={`flex-1 transition-all duration-300 ${!isImmersive ? 'md:pl-[80px] pb-16 md:pb-0' : 'p-0'}`}>
        {!isImmersive && <Navbar />}
        {children}
      </div>
    </div>
  );
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
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}
