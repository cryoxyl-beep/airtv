import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Home from './pages/Home';
import WatchPage from './pages/WatchPage';
import BrowsePage from './pages/BrowsePage';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import Navbar from './components/Navbar';

function ScrollManager() {
  useScrollRestoration();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watch/movie/:id" element={<WatchPage type="movie" />} />
        <Route path="/watch/tv/:id" element={<WatchPage type="tv" />} />
        <Route path="/browse/:platform" element={<BrowsePage />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
