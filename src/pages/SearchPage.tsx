import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  X,
} from 'lucide-react';
import { searchMovies, searchTV, fetchTrending, IMAGE_BASE_URL_W500 } from '../api/tmdb';
import { searchAnime, fetchTrendingAnime } from '../api/anilist';
import { SkeletonGrid } from '../components/MiyoroSkeletons';
import EmptyState from '../components/MiyoroEmptyStates';
import { LoadingButton } from '../components/MiyoroSpinner';
import RatingRing from '../components/MiyoroRatingRing';
import {
  MoviesIcon,
  TvIcon,
  AnimeIcon
} from '../components/MiyoroIcons';

type ActiveFilter = 'movies' | 'series' | 'anime' | '';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const filterParam = searchParams.get('filter');
  const filter: ActiveFilter = (filterParam === 'movies' || filterParam === 'series' || filterParam === 'anime') ? filterParam : '';
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputVal, setInputVal] = useState(query);
  const [results, setResults] = useState<any[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [searchError, setSearchError] = useState(false);
  const [isRetryingSearch, setIsRetryingSearch] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [categoryWarning, setCategoryWarning] = useState(false);
  const warningTimerRef = useRef<number | null>(null);

  const triggerCategoryWarning = () => {
    setCategoryWarning(true);
    if (warningTimerRef.current !== null) {
      window.clearTimeout(warningTimerRef.current);
    }
    warningTimerRef.current = window.setTimeout(() => {
      setCategoryWarning(false);
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (warningTimerRef.current !== null) {
        window.clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcut listener: press '/' to focus search bar (or prompt category selection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        if (!filter) {
          triggerCategoryWarning();
        } else {
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filter]);

  // Sync inputVal when URL query changes
  useEffect(() => {
    setInputVal(query);
  }, [query]);

  // Load default fallback items ("Maybe these ?") when no search query
  useEffect(() => {
    let mounted = true;
    const loadTrending = async () => {
      setLoadingTrending(true);
      try {
        const [tmdbTrending, animeTrending] = await Promise.all([
          fetchTrending().catch(() => ({ results: [] })),
          fetchTrendingAnime(24).catch(() => ({ results: [] })),
        ]);

        if (!mounted) return;

        const tmdbList = tmdbTrending.results || [];
        const animeList = animeTrending.results || [];

        // Interleave for rich variety
        const combined: any[] = [];
        const maxLen = Math.max(tmdbList.length, animeList.length);
        for (let i = 0; i < maxLen; i++) {
          if (tmdbList[i]) combined.push(tmdbList[i]);
          if (animeList[i]) combined.push(animeList[i]);
        }
        setTrendingItems(combined);
      } catch (e) {
        console.error('Failed to load items:', e);
      } finally {
        if (mounted) setLoadingTrending(false);
      }
    };

    loadTrending();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch search results when query or filter changes (category is mandatory)
  useEffect(() => {
    const fetchResults = async () => {
      if (!filter || !query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setSearchError(false);
      setResults([]);

      try {
        if (filter === 'movies') {
          const data = await searchMovies(query);
          setResults(data.results || []);
        } else if (filter === 'series') {
          const data = await searchTV(query);
          setResults(data.results || []);
        } else if (filter === 'anime') {
          const data = await searchAnime(query);
          setResults(data.results || []);
        }
      } catch (e) {
        console.error('Search failed', e);
        setSearchError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, filter]);

  // Debounced input change for instant search with skeleton feedback
  useEffect(() => {
    if (!filter) return;
    if (inputVal === query) return;

    if (!inputVal.trim()) {
      navigate(`/search?filter=${filter}`, { replace: true });
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(inputVal.trim())}&filter=${filter}`, { replace: true });
    }, 350);

    return () => clearTimeout(timer);
  }, [inputVal, query, filter, navigate]);

  const handleRetrySearch = async () => {
    if (!filter || !query.trim()) return;
    setIsRetryingSearch(true);
    setSearchError(false);
    setLoading(true);
    try {
      if (filter === 'movies') {
        const data = await searchMovies(query);
        setResults(data.results || []);
      } else if (filter === 'series') {
        const data = await searchTV(query);
        setResults(data.results || []);
      } else if (filter === 'anime') {
        const data = await searchAnime(query);
        setResults(data.results || []);
      }
    } catch (e) {
      setSearchError(true);
    } finally {
      setIsRetryingSearch(false);
      setLoading(false);
    }
  };

  const handleFilterClick = (clickedFilter: 'movies' | 'series' | 'anime') => {
    const nextFilter = filter === clickedFilter ? '' : clickedFilter;
    setCategoryWarning(false);

    if (!nextFilter) {
      setInputVal('');
      setResults([]);
      setLoading(false);
      navigate('/search');
      return;
    }

    if (inputVal.trim()) {
      setLoading(true);
      navigate(`/search?q=${encodeURIComponent(inputVal.trim())}&filter=${nextFilter}`);
    } else {
      setLoading(false);
      navigate(`/search?filter=${nextFilter}`);
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filter) {
      triggerCategoryWarning();
      return;
    }
    if (inputVal.trim()) {
      setLoading(true);
      navigate(`/search?q=${encodeURIComponent(inputVal.trim())}&filter=${filter}`);
    }
  };

  const handleCardClick = (item: any) => {
    if (item.source === 'anilist' || item.media_type === 'anime') {
      navigate(`/anime/${item.id}`, { state: { item } });
    } else {
      const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
      if (type === 'tv') {
        navigate(`/watch/tv/${item.id}`, { state: { item } });
      } else {
        navigate(`/watch/movie/${item.id}`, { state: { item } });
      }
    }
  };

  // Helper to extract poster, title, rating for each portrait card
  const getCardDetails = (item: any) => {
    const posterUrl = item.poster_path
      ? item.poster_path.startsWith('http')
        ? item.poster_path
        : `${IMAGE_BASE_URL_W500}${item.poster_path}`
      : item.coverImage?.extraLarge ||
        item.coverImage?.large ||
        (item.backdrop_path?.startsWith('http')
          ? item.backdrop_path
          : item.backdrop_path
          ? `${IMAGE_BASE_URL_W500}${item.backdrop_path}`
          : '/nyan-cat.gif');

    const backupUrl = item.backdrop_path
      ? item.backdrop_path.startsWith('http')
        ? item.backdrop_path
        : `${IMAGE_BASE_URL_W500}${item.backdrop_path}`
      : undefined;

    const title =
      item.title ||
      item.name ||
      item.original_title ||
      item.original_name ||
      'Untitled';

    const rawRating = item.vote_average
      ? Number(item.vote_average)
      : item.averageScore
      ? item.averageScore / 10
      : 0;

    const rating = rawRating > 0 ? rawRating : null;

    return { posterUrl, backupUrl, title, rating };
  };

  // Filter trending items when no search query is active
  const filteredTrending = trendingItems.filter((item) => {
    if (!filter) return true;
    if (filter === 'anime') return item.source === 'anilist' || item.media_type === 'anime';
    if (filter === 'movies')
      return (
        item.media_type === 'movie' ||
        (item.release_date && item.source !== 'anilist' && item.media_type !== 'anime')
      );
    if (filter === 'series')
      return (
        item.media_type === 'tv' ||
        (item.first_air_date && item.source !== 'anilist' && item.media_type !== 'anime')
      );
    return true;
  });

  const isSearching = Boolean(filter && query.trim());
  const activeList = isSearching ? results : filteredTrending;
  const isLoading = isSearching ? loading : loadingTrending;

  const FILTER_TABS: { id: 'movies' | 'series' | 'anime'; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'movies', label: 'Movies', icon: MoviesIcon },
    { id: 'series', label: 'TV Shows', icon: TvIcon },
    { id: 'anime', label: 'Anime', icon: AnimeIcon },
  ];

  const searchPlaceholder =
    filter === 'movies'
      ? 'Search movies...'
      : filter === 'series'
      ? 'Search TV shows...'
      : filter === 'anime'
      ? 'Search anime...'
      : 'Select a category below to start searching...';

  return (
    <div className="min-h-screen bg-black pt-6 sm:pt-10 px-4 sm:px-8 lg:px-12 pb-24 font-sans text-white select-none">
      <div className="max-w-[1450px] mx-auto space-y-6 sm:space-y-7">
        {/* 1. Sleek Search Bar UI (Category selection required before typing) */}
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div
            onClick={() => {
              if (!filter) {
                triggerCategoryWarning();
              }
            }}
            className={`relative flex items-center h-14 sm:h-15 px-5 bg-[#121318]/90 backdrop-blur-xl border rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-300 group ${
              !filter
                ? 'border-white/10 opacity-75 cursor-not-allowed'
                : 'border-white/12 focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10'
            }`}
          >
            <Search
              className={`w-5 h-5 shrink-0 mr-3.5 transition-colors ${
                !filter
                  ? 'text-white/30'
                  : 'text-white/45 group-focus-within:text-white'
              }`}
            />
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              readOnly={!filter}
              aria-disabled={!filter}
              onChange={(e) => {
                if (!filter) {
                  triggerCategoryWarning();
                  return;
                }
                setInputVal(e.target.value);
              }}
              onKeyDown={(e) => {
                if (!filter) {
                  if (e.key !== 'Tab') {
                    e.preventDefault();
                    triggerCategoryWarning();
                  }
                  return;
                }
                if (e.key === 'Enter') {
                  handleSearchSubmit(e);
                }
              }}
              placeholder={searchPlaceholder}
              className={`w-full bg-transparent text-base sm:text-lg text-white placeholder:text-white/35 outline-none font-medium tracking-wide ${
                !filter ? 'cursor-not-allowed' : ''
              }`}
              autoFocus={Boolean(filter)}
            />
            {inputVal && filter ? (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  navigate(`/search?filter=${filter}`);
                  inputRef.current?.focus();
                }}
                className="p-1.5 rounded-full hover:bg-white/15 text-white/50 hover:text-white transition-all cursor-pointer active:scale-90"
                aria-label="Clear Search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center justify-center w-7 h-7 text-xs text-white/40 font-mono bg-white/5 border border-white/10 rounded-md shadow-inner select-none">
                /
              </kbd>
            )}
          </div>
        </form>

        {/* 2. Mandatory Category Filter Pills Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterClick(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-[#1C1D24] border border-white/25 text-white shadow-md'
                    : categoryWarning
                    ? 'text-white bg-white/12 border border-white/45 ring-2 ring-white/20 shadow-[0_0_16px_rgba(255,255,255,0.12)]'
                    : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5'
                }`}
              >
                <Icon size={18} active={isActive} className="shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          {!filter && (
            <span
              className={`ml-1 text-xs sm:text-sm font-medium transition-colors duration-200 ${
                categoryWarning ? 'text-white' : 'text-white/45'
              }`}
            >
              Select a category to search
            </span>
          )}
        </div>

        {/* 3. Section Header: "Maybe these ?" / Search Results */}
        <div className="flex items-center justify-between pt-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {isSearching ? `Showing results for "${query}"` : 'Maybe these ?'}
          </h2>
        </div>

        {/* 4. Content Grid / Skeletons / Empty States */}
        {!isOnline ? (
          <div className="py-16 flex justify-center">
            <EmptyState variant="offline" />
          </div>
        ) : searchError ? (
          <div className="py-16 flex justify-center">
            <EmptyState
              variant="error"
              action={
                <LoadingButton
                  loading={isRetryingSearch}
                  onClick={handleRetrySearch}
                  className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-white/90 transition-all cursor-pointer shadow-lg"
                >
                  Try again
                </LoadingButton>
              }
            />
          </div>
        ) : isLoading ? (
          <div className="pt-2">
            <SkeletonGrid count={14} minWidth={160} />
          </div>
        ) : isSearching && activeList.length === 0 ? (
          <div className="py-16 flex justify-center">
            <EmptyState variant="search" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
            {activeList.map((item, index) => {
              const { posterUrl, backupUrl, title, rating } = getCardDetails(item);

              return (
                <div
                  key={(item.id || item.mal_id || index) + '-' + index}
                  onClick={() => handleCardClick(item)}
                  className="relative z-10 flex-shrink-0 cursor-pointer flex flex-col group transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-105"
                >
                  {/* Portrait Poster Container with Homepage Poster Hover Animation & Glow */}
                  <div className="relative rounded-xl overflow-hidden bg-[#141414] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] group-hover:border-white/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.15)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] z-20 aspect-[2/3] w-full">
                    <img
                      src={posterUrl}
                      alt={title}
                      loading={index < 7 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] group-hover:scale-105 group-hover:brightness-105"
                      onError={(e) => {
                        if (backupUrl && (e.currentTarget as HTMLImageElement).src !== backupUrl) {
                          (e.currentTarget as HTMLImageElement).src = backupUrl;
                        }
                      }}
                    />
                    <RatingRing value={rating} corner="top-right" className="z-30" />
                  </div>

                  {/* Clean Title Only underneath poster */}
                  <div className="pt-2.5 px-0.5">
                    <h3
                      className="text-sm font-bold text-white truncate group-hover:text-white transition-colors"
                      title={title}
                    >
                      {title}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
