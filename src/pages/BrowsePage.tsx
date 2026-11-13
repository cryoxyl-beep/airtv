import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchByProvider, fetchTVByProvider, IMAGE_BASE_URL_W500 } from '../api/tmdb';
import RatingRing from '../components/MiyoroRatingRing';
import EmptyState from '../components/MiyoroEmptyStates';
import { SkeletonCard } from '../components/MiyoroSkeletons';
import { LoadingButton } from '../components/MiyoroSpinner';
import { MoviesIcon, TvIcon } from '../components/MiyoroIcons';
import { ChevronDown } from 'lucide-react';
import { logos } from '../assets/logos';

const platforms = {
  'netflix': { id: 8, name: 'Netflix', logo: logos.netflix, accentRgb: '229, 9, 20' },
  'prime-video': { id: 9, name: 'Prime Video', logo: logos.prime, accentRgb: '0, 168, 225' },
  'disney-plus': { id: 337, name: 'Disney+', logo: logos.disney, accentRgb: '34, 92, 230' },
  'apple-tv-plus': { id: 350, name: 'Apple TV+', logo: logos.apple, accentRgb: '210, 214, 224' },
  'hulu': { id: 15, name: 'Hulu', logo: logos.hulu, accentRgb: '28, 231, 131' },
  'hbo-max': { id: 1899, name: 'HBO Max', logo: logos.hbo, accentRgb: '140, 72, 235' },
  'paramount': { id: 531, name: 'Paramount+', logo: logos.paramount, accentRgb: '0, 100, 255' },
};

function getGridColumns(viewportWidth: number): number {
  if (viewportWidth >= 1536) return 7; // 2xl
  if (viewportWidth >= 1280) return 6; // xl
  if (viewportWidth >= 1024) return 5; // lg
  if (viewportWidth >= 768) return 4;  // md
  if (viewportWidth >= 640) return 3;  // sm
  return 2;
}

function getRowsPerBatch(cols: number): number {
  return Math.max(3, Math.ceil(18 / cols));
}

export default function BrowsePage() {
  const { platform } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'movie' | 'tv'>(() => {
    return (sessionStorage.getItem(`browse-tab-${location.key}`) as 'movie' | 'tv') || 'movie';
  });

  const [cols, setCols] = useState<number>(() =>
    typeof window !== 'undefined' ? getGridColumns(window.innerWidth) : 6
  );
  const [visibleRows, setVisibleRows] = useState<number>(() =>
    getRowsPerBatch(typeof window !== 'undefined' ? getGridColumns(window.innerWidth) : 6)
  );
  const [poolItems, setPoolItems] = useState<any[]>([]);
  const [hasMoreApi, setHasMoreApi] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const requestIdRef = useRef(0);
  const poolRef = useRef<any[]>([]);
  const nextApiPageRef = useRef(1);
  const totalApiPagesRef = useRef(1);
  const platformInfo = platform ? platforms[platform as keyof typeof platforms] : null;

  useEffect(() => {
    const handleResize = () => {
      const nextCols = getGridColumns(window.innerWidth);
      setCols((prev) => (prev === nextCols ? prev : nextCols));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(`browse-tab-${location.key}`, activeTab);
  }, [activeTab, location.key]);

  const fetchPagesUntilCount = useCallback(
    async (providerId: number, tab: 'movie' | 'tv', targetCount: number, reqId: number) => {
      let emptyPageStreak = 0;

      while (
        poolRef.current.length < targetCount &&
        nextApiPageRef.current <= totalApiPagesRef.current &&
        emptyPageStreak < 5
      ) {
        const pageToFetch = nextApiPageRef.current;
        const data =
          tab === 'movie'
            ? await fetchByProvider(providerId, pageToFetch)
            : await fetchTVByProvider(providerId, pageToFetch);

        if (requestIdRef.current !== reqId) return false;

        totalApiPagesRef.current = data.total_pages || 1;
        nextApiPageRef.current = pageToFetch + 1;

        const valid = (data.results || []).filter(
          (item: any) => Boolean(item.poster_path || item.backdrop_path)
        );
        const existingIds = new Set(poolRef.current.map((p) => p.id));
        const uniqueNew = valid.filter((item: any) => !existingIds.has(item.id));

        if (uniqueNew.length === 0) {
          emptyPageStreak += 1;
        } else {
          emptyPageStreak = 0;
          poolRef.current = [...poolRef.current, ...uniqueNew];
        }
      }

      if (requestIdRef.current !== reqId) return false;

      setPoolItems(poolRef.current);
      setHasMoreApi(nextApiPageRef.current <= totalApiPagesRef.current && emptyPageStreak < 5);
      return true;
    },
    []
  );

  useEffect(() => {
    if (!platformInfo) {
      navigate('/home');
      return;
    }

    const reqId = ++requestIdRef.current;
    const initialRows = getRowsPerBatch(getGridColumns(window.innerWidth));
    const initialTarget = initialRows * getGridColumns(window.innerWidth);

    poolRef.current = [];
    nextApiPageRef.current = 1;
    totalApiPagesRef.current = 1;
    setVisibleRows(initialRows);
    setPoolItems([]);
    setHasMoreApi(true);
    setLoading(true);
    setLoadingMore(false);
    setError(false);

    const loadInitial = async () => {
      try {
        await fetchPagesUntilCount(platformInfo.id, activeTab, initialTarget, reqId);
      } catch (err) {
        console.error('Failed to load provider data', err);
        if (requestIdRef.current === reqId) setError(true);
      } finally {
        if (requestIdRef.current === reqId) setLoading(false);
      }
    };

    loadInitial();
  }, [platformInfo, activeTab, navigate, fetchPagesUntilCount]);

  // If viewport widens (e.g. 6 cols -> 7 cols), top up buffered items so rows remain completely full
  useEffect(() => {
    if (!platformInfo || loading || loadingMore || error) return;
    const targetCount = visibleRows * cols;
    if (poolRef.current.length < targetCount && hasMoreApi) {
      const reqId = requestIdRef.current;
      fetchPagesUntilCount(platformInfo.id, activeTab, targetCount, reqId).catch((err) => {
        console.error('Failed to top up provider titles on resize', err);
      });
    }
  }, [cols, visibleRows, platformInfo, activeTab, loading, loadingMore, error, hasMoreApi, fetchPagesUntilCount]);

  if (!platformInfo) return null;

  const targetCount = visibleRows * cols;
  const fullDisplayCount =
    poolItems.length >= cols
      ? Math.floor(Math.min(poolItems.length, targetCount) / cols) * cols
      : poolItems.length;
  const displayedItems = poolItems.slice(0, fullDisplayCount);
  const canLoadMore = poolItems.length > displayedItems.length || hasMoreApi;

  const handleLoadMore = async () => {
    if (loading || loadingMore || !canLoadMore) return;
    const reqId = requestIdRef.current;
    const nextRows = visibleRows + getRowsPerBatch(cols);
    const nextTarget = nextRows * cols;

    if (poolRef.current.length >= nextTarget || !hasMoreApi) {
      setVisibleRows(nextRows);
      return;
    }

    setLoadingMore(true);
    try {
      const ok = await fetchPagesUntilCount(platformInfo.id, activeTab, nextTarget, reqId);
      if (ok && requestIdRef.current === reqId) {
        setVisibleRows(nextRows);
      }
    } catch (err) {
      console.error('Failed to load more provider titles', err);
    } finally {
      if (requestIdRef.current === reqId) {
        setLoadingMore(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black font-sans pb-24 w-full text-white select-none relative overflow-x-hidden">
      {/* Header Section */}
      <div className="relative pt-8 sm:pt-12 pb-8 px-4 sm:px-8 lg:px-12 z-20">
        {/* Subtle platform ambient glow fading smoothly to pure black */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
          style={{
            background: `radial-gradient(ellipse 65% 85% at 50% 0%, rgba(${platformInfo.accentRgb}, 0.16) 0%, rgba(${platformInfo.accentRgb}, 0.04) 48%, rgba(0, 0, 0, 0) 100%)`,
          }}
        />

        {/* Platform Identity & Filter Controls */}
        <div className="max-w-[1450px] mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex flex-col items-start">
            <img
              src={platformInfo.logo}
              alt={platformInfo.name}
              className="h-11 sm:h-14 md:h-16 max-w-[220px] object-contain object-left drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
              draggable={false}
            />
          </div>

          {/* Filter Tabs using MiyoroIcons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('movie')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ${
                activeTab === 'movie'
                  ? 'bg-[#1C1D24] border border-white/25 text-white shadow-md'
                  : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5'
              }`}
            >
              <MoviesIcon size={18} active={activeTab === 'movie'} className="shrink-0" />
              <span>Movies</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tv')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ${
                activeTab === 'tv'
                  ? 'bg-[#1C1D24] border border-white/25 text-white shadow-md'
                  : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5'
              }`}
            >
              <TvIcon size={18} active={activeTab === 'tv'} className="shrink-0" />
              <span>TV Shows</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Portrait Poster Grid Container */}
      <div className="px-4 sm:px-8 lg:px-12 relative z-20">
        <div className="max-w-[1450px] mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
              {Array.from({ length: getRowsPerBatch(cols) * cols }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="py-16 flex justify-center">
              <EmptyState variant="error" />
            </div>
          ) : displayedItems.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
                {displayedItems.map((item, index) => (
                  <GridCard key={`${item.media_type || activeTab}-${item.id}`} item={item} index={index} />
                ))}
              </div>

              {canLoadMore && (
                <div className="mt-14 flex justify-center">
                  <LoadingButton
                    type="button"
                    loading={loadingMore}
                    onClick={handleLoadMore}
                    className="group px-8 py-3 rounded-full bg-white hover:bg-white/90 text-black font-bold text-xs sm:text-sm tracking-wide shadow-[0_6px_24px_rgba(255,255,255,0.14)] hover:shadow-[0_8px_30px_rgba(255,255,255,0.24)] active:scale-95 transition-all duration-200 cursor-pointer"
                  >
                    <span>{loadingMore ? 'Loading' : 'Load More'}</span>
                    {!loadingMore && (
                      <ChevronDown className="w-4 h-4 stroke-[2.5] transition-transform duration-200 group-hover:translate-y-0.5" />
                    )}
                  </LoadingButton>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 flex justify-center">
              <EmptyState variant="search" title="No titles found" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GridCard({ item, index }: { item: any; index: number }) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  const posterUrl = item.poster_path
    ? item.poster_path.startsWith('http')
      ? item.poster_path
      : `${IMAGE_BASE_URL_W500}${item.poster_path}`
    : item.backdrop_path
    ? item.backdrop_path.startsWith('http')
      ? item.backdrop_path
      : `${IMAGE_BASE_URL_W500}${item.backdrop_path}`
    : '';

  const backupUrl = item.backdrop_path
    ? item.backdrop_path.startsWith('http')
      ? item.backdrop_path
      : `${IMAGE_BASE_URL_W500}${item.backdrop_path}`
    : undefined;

  const title = item.title || item.name || item.original_title || item.original_name || 'Untitled';
  const rawRating = item.vote_average
    ? Number(item.vote_average)
    : item.averageScore
    ? item.averageScore / 10
    : 0;
  const rating = rawRating > 0 ? rawRating : null;

  return (
    <div
      onClick={() => {
        if (item.source === 'anilist') {
          navigate(`/anime/${item.id}`, { state: { item } });
        } else {
          const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
          if (type === 'tv') {
            navigate(`/watch/tv/${item.id}`, { state: { item } });
          } else {
            navigate(`/watch/movie/${item.id}`, { state: { item } });
          }
        }
      }}
      className="relative z-10 flex-shrink-0 cursor-pointer flex flex-col group transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-105"
    >
      {/* Portrait Poster Container with Homepage/Search Hover Animation & Glow */}
      <div className="relative rounded-xl overflow-hidden bg-[#141414] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] group-hover:border-white/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.15)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] z-20 aspect-[2/3] w-full">
        {!imgFailed && posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading={index < 7 ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            className="w-full h-full object-cover transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] group-hover:scale-105 group-hover:brightness-105"
            onError={(e) => {
              if (backupUrl && (e.currentTarget as HTMLImageElement).src !== backupUrl) {
                (e.currentTarget as HTMLImageElement).src = backupUrl;
              } else {
                setImgFailed(true);
              }
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1C1D24] to-[#0D0E12] flex flex-col items-center justify-center p-4 text-center">
            <MoviesIcon size={28} className="text-white/25 mb-2" />
            <span className="text-xs font-medium text-white/60 line-clamp-2">{title}</span>
          </div>
        )}
        <RatingRing value={rating} corner="top-right" className="z-30" />
      </div>

      {/* Clean Title Only below portrait poster */}
      <div className="pt-2.5 px-0.5">
        <h3 className="text-sm font-bold text-white truncate group-hover:text-white transition-colors" title={title}>
          {title}
        </h3>
      </div>
    </div>
  );
}
