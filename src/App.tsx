import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Home from './pages/Home';
import WatchPage from './pages/WatchPage';
import { useScrollRestoration } from './hooks/useScrollRestoration';

function ScrollManager() {
  useScrollRestoration();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watch/movie/:id" element={<WatchPage type="movie" />} />
        <Route path="/watch/tv/:id" element={<WatchPage type="tv" />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
