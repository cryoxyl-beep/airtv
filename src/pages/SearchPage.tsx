import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  Clapperboard,
  Tv,
  Compass,
  Clock,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { searchMovies, searchTV, fetchTrending, IMAGE_BASE_URL_W500 } from '../api/tmdb';
import { searchAnime, fetchTrendingAnime } from '../api/anilist';

type FilterType = 'all' | 'movies' | 'series' | 'anime';

interface RecentSearchItem {
  id: string;
  text: string;
}

const DEFAULT_RECENT_SEARCHES: string[] = [
  'Jujutsu Kaisen',
  'Attack on Titan',
  'Spy x Family',
  'Bleach',
];

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const filter = (searchParams.get('filter') as FilterType) || 'all';
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputVal, setInputVal] = useState(query);
  const [results, setResults] = useState<any[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);

  // Recent searches stored in localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('recent_searches_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_RECENT_SEARCHES;
  });

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('recent_searches_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleRemoveRecent = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== termToRemove);
      try {
        localStorage.setItem('recent_searches_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('recent_searches_v2');
    } catch (e) {}
  };

  const handleRecentClick = (term: string) => {
    setInputVal(term);
    saveRecentSearch(term);
    navigate(`/search?q=${encodeURIComponent(term)}&filter=${filter}`);
  };

  // Keyboard shortcut listener: press '/' to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync inputVal when URL query changes
  useEffect(() => {
    setInputVal(query);
  }, [query]);

  // Load Trending in India when no search query
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
        console.error('Failed to load trending items:', e);
      } finally {
        if (mounted) setLoadingTrending(false);
      }
    };

    loadTrending();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch search results when query or filter changes
  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
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
        } else {
          const [movies, tv, anime] = await Promise.all([
            searchMovies(query),
            searchTV(query),
            searchAnime(query),
          ]);

          const maxLength = Math.max(
            movies.results?.length || 0,
            tv.results?.length || 0,
            anime.results?.length || 0
          );

          const interleaved = [];
          for (let i = 0; i < maxLength; i++) {
            if (movies.results && movies.results[i]) interleaved.push(movies.results[i]);
            if (tv.results && tv.results[i]) interleaved.push(tv.results[i]);
            if (anime.results && anime.results[i]) interleaved.push(anime.results[i]);
          }

          setResults(interleaved);
        }
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, filter]);

  const handleFilterClick = (newFilter: FilterType) => {
    navigate(`/search?q=${encodeURIComponent(inputVal.trim())}&filter=${newFilter}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      saveRecentSearch(inputVal);
      navigate(`/search?q=${encodeURIComponent(inputVal.trim())}&filter=${filter}`);
    }
  };

  const handleDiscoverClick = () => {
    // Shuffle trending items for exciting discovery
    setTrendingItems((prev) => [...prev].sort(() => Math.random() - 0.5));
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

  // Helper to extract poster, title, rating, year, and type for each portrait card
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

    const releaseYear = item.first_air_date
      ? new Date(item.first_air_date).getFullYear()
      : item.release_date
      ? new Date(item.release_date).getFullYear()
      : item.startDate?.year || item.anilist_raw?.seasonYear || null;

    let mediaTypeLabel = 'Movie';
    if (item.source === 'anilist' || item.media_type === 'anime') {
      mediaTypeLabel = 'Anime';
    } else if (item.media_type === 'tv' || item.first_air_date) {
      mediaTypeLabel = 'TV Show';
    } else if (item.media_type === 'movie' || item.release_date) {
      mediaTypeLabel = 'Movie';
    }

    return { posterUrl, backupUrl, title, rating, releaseYear, mediaTypeLabel };
  };

  // Filter trending items when no search query is active
  const filteredTrending = trendingItems.filter((item) => {
    if (filter === 'all') return true;
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

  const isSearching = Boolean(query.trim());
  const activeList = isSearching ? results : filteredTrending;
  const isLoading = isSearching ? loading : loadingTrending;

  const FILTER_TABS = [
    { id: 'all', label: 'All', icon: LayoutGrid },
    { id: 'movies', label: 'Movies', icon: Clapperboard },
    { id: 'series', label: 'TV Shows', icon: Tv },
    { id: 'anime', label: 'Anime', icon: Compass },
  ];

  return (
    <div className="min-h-screen bg-black pt-6 sm:pt-10 px-4 sm:px-8 lg:px-12 pb-24 font-sans text-white select-none">
      <div className="max-w-[1450px] mx-auto space-y-6 sm:space-y-7">
        {/* 1. Large Search Input (Image 2 style with shortcut badge, NO back button) */}
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="relative flex items-center h-13 sm:h-14 px-4 sm:px-5 bg-[#0e0f12] border border-white/10 focus-within:border-white/25 rounded-xl shadow-xl transition-all duration-200">
            <Search className="w-5 h-5 text-white/40 shrink-0 mr-3.5" />
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                if (!e.target.value) {
                  navigate(`/search?q=&filter=${filter}`);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit(e);
                }
              }}
              placeholder="Find the perfect rom-com..."
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-white/40 outline-none"
              autoFocus
            />
            {inputVal ? (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  navigate(`/search?q=&filter=${filter}`);
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                aria-label="Clear Search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center justify-center w-6 h-6 text-xs text-white/40 font-mono bg-white/5 border border-white/10 rounded">
                /
              </kbd>
            )}
          </div>
        </form>

        {/* 2. Filter Pills Bar (Image 2 style with icons & dark rounded-lg states) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.id || (!filter && tab.id === 'all');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterClick(tab.id as FilterType)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1C1D22] border border-white/20 text-white shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 3. RECENT SEARCHES (Image 2 style with chips, clock icon, close button, and Clear all) */}
        {recentSearches.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/40 tracking-wider uppercase">
                Recent Searches
              </span>
              <button
                type="button"
                onClick={handleClearRecent}
                className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {recentSearches.map((term) => (
                <div
                  key={term}
                  onClick={() => handleRecentClick(term)}
                  className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131418] border border-white/10 hover:border-white/25 text-white/80 hover:text-white text-xs sm:text-sm transition-all cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
                  <span>{term}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRecent(term, e)}
                    className="text-white/40 hover:text-white p-0.5 ml-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label={`Remove ${term}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Section Header: Trending in India / Search Results */}
        <div className="flex items-center justify-between pt-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {isSearching ? `Showing results for "${query}"` : 'Trending in India'}
          </h2>
          {!isSearching && (
            <button
              type="button"
              onClick={handleDiscoverClick}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#18191E] hover:bg-[#22242B] border border-white/10 text-xs sm:text-sm font-semibold text-white/90 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-white/70" />
              <span>Discover</span>
            </button>
          )}
        </div>

        {/* 5. Portrait Poster Cards Grid (aspect-[2/3], title, star rating, year, type) */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
            {[...Array(14)].map((_, i) => (
              <div key={i} className="flex flex-col space-y-2.5 animate-pulse">
                <div className="aspect-[2/3] w-full bg-white/5 rounded-xl border border-white/5" />
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : isSearching && activeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/40 text-center space-y-2">
            <p className="text-lg font-medium">No results found for "{query}"</p>
            <p className="text-xs sm:text-sm text-white/30">
              Try checking your spelling or searching for a different keyword.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
            {activeList.map((item, index) => {
              const { posterUrl, backupUrl, title, rating, releaseYear, mediaTypeLabel } =
                getCardDetails(item);

              return (
                <div
                  key={(item.id || item.mal_id || index) + '-' + index}
                  onClick={() => handleCardClick(item)}
                  className="group cursor-pointer flex flex-col"
                >
                  {/* Portrait Poster Container (aspect-[2/3], rounded-xl, hover scale) */}
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#161619] border border-white/10 shadow-md group-hover:border-white/25 group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.85)] transition-all duration-300">
                    <img
                      src={posterUrl}
                      alt={title}
                      loading={index < 7 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        if (backupUrl && (e.currentTarget as HTMLImageElement).src !== backupUrl) {
                          (e.currentTarget as HTMLImageElement).src = backupUrl;
                        }
                      }}
                    />
                  </div>

                  {/* Metadata underneath the portrait card (matching Image 2) */}
                  <div className="pt-2.5 px-0.5">
                    <h3
                      className="text-sm font-bold text-white truncate group-hover:text-white transition-colors"
                      title={title}
                    >
                      {title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-white/50 pt-0.5">
                      {rating && (
                        <>
                          <span className="text-white/90 font-medium flex items-center gap-1">
                            <span className="text-white">★</span> {rating.toFixed(1)}
                          </span>
                          <span>·</span>
                        </>
                      )}
                      {releaseYear && (
                        <>
                          <span>{releaseYear}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{mediaTypeLabel}</span>
                    </div>
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
