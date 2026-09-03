import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Home from './pages/Home';
import WatchPage from './pages/WatchPage';
import PlayerPage from './pages/PlayerPage';
import BrowsePage from './pages/BrowsePage';
import SearchPage from './pages/SearchPage';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import Navbar from './components/Navbar';
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollManager />
        <GlobalShortcuts />
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Home />} />
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
      </BrowserRouter>
    </AuthProvider>
  );
}
