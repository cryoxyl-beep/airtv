import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Home from './pages/Home';
import WatchPage from './pages/WatchPage';

const TVRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/watch/tv/${id}/season/1/episode/1`} replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watch/movie/:id" element={<WatchPage type="movie" />} />
        <Route path="/watch/tv/:id" element={<TVRedirect />} />
        <Route path="/watch/tv/:id/season/:season/episode/:episode" element={<WatchPage type="tv" />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
