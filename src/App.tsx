import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import WatchPage from './pages/WatchPage';
import BrowsePage from './pages/BrowsePage';
import SearchPage from './pages/SearchPage';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import Navbar from './components/Navbar';

function GlobalShortcuts() {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        
        // Dispatch custom event to let Navbar handle focusing and visibility
        window.dispatchEvent(new CustomEvent('focus-search'));
      }
      
      // Escape to close if on search input (optional: we handle it locally if needed)
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
    <BrowserRouter>
      <ScrollManager />
      <GlobalShortcuts />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watch/movie/:id" element={<WatchPage type="movie" />} />
        <Route path="/watch/tv/:id" element={<WatchPage type="tv" />} />
        <Route path="/watch/tv/:id/:season/:episode" element={<WatchPage type="tv" />} />
        <Route path="/anime/:id" element={<WatchPage type="anime" />} />
        <Route path="/anime/:id/:episode" element={<WatchPage type="anime" />} />
        <Route path="/browse/:platform" element={<BrowsePage />} />
        <Route path="/search" element={<SearchPage />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
