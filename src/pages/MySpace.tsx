import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Play, Film, Clock, Heart, ArrowRight } from 'lucide-react';
import { fetchDetails, IMAGE_BASE_URL_W500 } from '../api/tmdb';
import { fetchAnimeDetails } from '../api/anilist';
import { getAllWatchProgressItems } from '../utils/preferences';
import EmptyState from '../components/MiyoroEmptyStates';
import { LoadingButton } from '../components/MiyoroSpinner';

interface WatchItem {
  key: string;
  type: 'movie' | 'tv' | 'anime';
  id: string;
  season?: number;
  episode?: number;
  progress: number;
  currentTime?: number;
  duration?: number;
  updatedAt: number;
  title?: string;
  poster?: string;
  backdrop?: string;
}

export default function MySpace() {
  const { currentUser, signInWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const [continueWatching, setContinueWatching] = useState<WatchItem[]>([]);
  const [libraryItems, setLibraryItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSavedData = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        // 1. Load unified Continue Watching (Firestore-synced when signed in, localStorage when guest)
        const items: WatchItem[] = getAllWatchProgressItems();

        // Fetch title & poster metadata for up to top 12 continue watching items
        const enrichedItems = await Promise.all(
          items.slice(0, 12).map(async (item) => {
            try {
              if (item.type === 'anime') {
                const anime = await fetchAnimeDetails(parseInt(item.id, 10));
                return {
                  ...item,
                  title: anime?.title || anime?.name || `Anime #${item.id}`,
                  poster: anime?.poster_path || anime?.backdrop_path,
                  backdrop: anime?.backdrop_path || anime?.poster_path,
                };
              } else {
                const details = await fetchDetails(parseInt(item.id, 10), item.type);
                return {
                  ...item,
                  title: details?.title || details?.name || `${item.type.toUpperCase()} #${item.id}`,
                  poster: details?.poster_path || details?.backdrop_path,
                  backdrop: details?.backdrop_path || details?.poster_path,
                };
              }
            } catch (e) {
              return {
                ...item,
                title: `${item.type.toUpperCase()} #${item.id}`,
              };
            }
          })
        );

        if (!isMounted) return;
        setContinueWatching(enrichedItems);

        // 2. Load Library items
        const rawLib = localStorage.getItem('miyoro_library_items');
        if (rawLib) {
          setLibraryItems(JSON.parse(rawLib));
        }
      } catch (e) {
        console.warn('Error loading My Space data:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSavedData(true);

    const handleHistoryUpdated = () => {
      loadSavedData(false);
    };
    window.addEventListener('miyoro-watch-history-updated', handleHistoryUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('miyoro-watch-history-updated', handleHistoryUpdated);
    };
  }, [currentUser?.uid]);

  const handleResumePlay = (item: WatchItem) => {
    if (item.type === 'movie') {
      navigate(`/play/movie/${item.id}`);
    } else if (item.type === 'tv') {
      navigate(`/play/tv/${item.id}/${item.season || 1}/${item.episode || 1}`);
    } else if (item.type === 'anime') {
      navigate(`/play/anime/${item.id}/${item.episode || 1}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-24 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* User Profile Header Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#141414] via-[#1a1a1a] to-[#121212] border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-[#242424] border-2 border-white/20 flex items-center justify-center shrink-0 shadow-lg">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white/70" />
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {currentUser ? currentUser.displayName || 'Member' : 'My Space'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/80 border border-white/10">
                  {currentUser ? 'Signed In' : 'Guest'}
                </span>
              </div>
              <p className="text-sm text-white/60 max-w-xl">
                {currentUser 
                  ? currentUser.email 
                  : 'Sign in with your Google account to synchronize your watch progress, library, and continue watching list across all devices.'}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={logout}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium border border-white/15 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <LoadingButton
                    type="button"
                    loading={isSigningIn}
                    onClick={async () => {
                      setIsSigningIn(true);
                      try {
                        await signInWithGoogle();
                      } finally {
                        setIsSigningIn(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-full bg-white hover:bg-white/90 text-black text-xs sm:text-sm font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                    <span>Sign in with Google</span>
                  </LoadingButton>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Continue Watching */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-white/70" />
              <h2 className="text-xl sm:text-2xl font-bold tracking-wide">Continue Watching</h2>
            </div>
            {continueWatching.length > 0 && (
              <span className="text-xs text-white/50">{continueWatching.length} titles</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-video bg-white/5 rounded-xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : continueWatching.length === 0 ? (
            <div className="py-6 flex justify-center">
              <EmptyState variant="history" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {continueWatching.map((item) => {
                const imgUrl = item.backdrop || item.poster;
                const fullImg = imgUrl
                  ? imgUrl.startsWith('http')
                    ? imgUrl
                    : `${IMAGE_BASE_URL_W500}${imgUrl}`
                  : null;

                return (
                  <div
                    key={item.key}
                    onClick={() => handleResumePlay(item)}
                    className="group relative rounded-xl overflow-hidden bg-[#161616] border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-lg flex flex-col"
                  >
                    {/* Media Thumbnail */}
                    <div className="relative aspect-video w-full bg-black/60 overflow-hidden">
                      {fullImg ? (
                        <img
                          src={fullImg}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          <Film className="w-8 h-8" />
                        </div>
                      )}

                      {/* Play overlay button */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Progress bar at bottom of image */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(5, (item.progress || 0.35) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="p-3.5 flex flex-col justify-between flex-1 gap-1">
                      <h3 className="font-semibold text-sm text-white truncate group-hover:text-white/90">
                        {item.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-white/50">
                        <span>
                          {item.type === 'movie'
                            ? 'Movie'
                            : item.type === 'tv'
                            ? `S${item.season || 1} • E${item.episode || 1}`
                            : `Ep. ${item.episode || 1}`}
                        </span>
                        <span className="uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                          {item.type}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Library & Favorites */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Heart className="w-5 h-5 text-white/70" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-wide">Saved in Library</h2>
          </div>

          {libraryItems.length === 0 ? (
            <div className="py-6 flex justify-center">
              <EmptyState
                variant="list"
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    className="px-5 py-2 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-white/90 transition-all cursor-pointer shadow-md"
                  >
                    Browse
                  </button>
                }
              />
            </div>
          ) : (
            <div className="text-sm text-white/60">
              {libraryItems.length} item{libraryItems.length === 1 ? '' : 's'} saved in your private library.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
