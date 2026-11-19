import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Calendar,
  MapPin,
  Sparkles,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import {
  fetchTrendingPeople,
  fetchPersonDetails,
  fetchPersonCombinedCredits,
  getCachedPersonDetails,
  getCachedPersonCombinedCredits,
  fetchDetails,
  IMAGE_BASE_URL_W500,
  IMAGE_BASE_URL,
  TrendingActorSummary,
  ActorDetails,
  ActorCreditItem,
} from '../api/tmdb';
import RatingRing from '../components/MiyoroRatingRing';
import EmptyState from '../components/MiyoroEmptyStates';
import { LoadingButton } from '../components/MiyoroSpinner';
import { DiscoverIcon, MoviesIcon, TvIcon } from '../components/MiyoroIcons';

type TimeWindow = 'week' | 'day';
type MediaFilter = 'all' | 'movie' | 'tv';
type CreditSortMode = 'popular' | 'newest' | 'rating' | 'oldest';

interface DiscoverBucketState {
  actors: TrendingActorSummary[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  initialized: boolean;
}

// Session-persistent in-memory store so navigating to a title and returning preserves actors, filter, and scroll positions
const discoverBuckets: Record<TimeWindow, DiscoverBucketState> = {
  week: { actors: [], page: 0, totalPages: 1, hasMore: true, initialized: false },
  day: { actors: [], page: 0, totalPages: 1, hasMore: true, initialized: false },
};
let persistedTimeWindow: TimeWindow = 'week';
let persistedWindowScrollY = 0;
const actorRailScrollPositions = new Map<number, number>();

// Shared IntersectionObserver for progressive actor section hydration
const sectionVisibilityCallbacks = new Map<Element, () => void>();
let sectionObserver: IntersectionObserver | null = null;

function getSectionObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return null;
  if (!sectionObserver) {
    sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cb = sectionVisibilityCallbacks.get(entry.target);
            if (cb) {
              cb();
              sectionObserver?.unobserve(entry.target);
              sectionVisibilityCallbacks.delete(entry.target);
            }
          }
        });
      },
      { rootMargin: '650px 0px' }
    );
  }
  return sectionObserver;
}

function observeActorSection(el: Element, callback: () => void) {
  const obs = getSectionObserver();
  if (!obs) {
    callback();
    return;
  }
  sectionVisibilityCallbacks.set(el, callback);
  obs.observe(el);
}

function unobserveActorSection(el: Element) {
  sectionVisibilityCallbacks.delete(el);
  sectionObserver?.unobserve(el);
}

function formatBirthday(birthday: string | null, deathday?: string | null): string | null {
  if (!birthday) return null;
  try {
    const birthDate = new Date(`${birthday}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return birthday;
    const formatted = birthDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (deathday) {
      return `${formatted}`;
    }
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 && age < 120 ? `${formatted} (${age})` : formatted;
  } catch {
    return birthday;
  }
}

function sortActorCredits(credits: ActorCreditItem[], mode: CreditSortMode): ActorCreditItem[] {
  const copy = [...credits];
  if (mode === 'newest') {
    copy.sort((a, b) => {
      const yearA = a.release_year ?? 0;
      const yearB = b.release_year ?? 0;
      if (yearB !== yearA) return yearB - yearA;
      return (b.popularity || 0) - (a.popularity || 0);
    });
  } else if (mode === 'oldest') {
    copy.sort((a, b) => {
      const yearA = a.release_year ?? 9999;
      const yearB = b.release_year ?? 9999;
      if (yearA !== yearB) return yearA - yearB;
      return (b.popularity || 0) - (a.popularity || 0);
    });
  } else if (mode === 'rating') {
    copy.sort((a, b) => {
      const voteWeightA = (a.vote_count || 0) >= 25 ? a.vote_average || 0 : (a.vote_average || 0) * 0.65;
      const voteWeightB = (b.vote_count || 0) >= 25 ? b.vote_average || 0 : (b.vote_average || 0) * 0.65;
      if (Math.abs(voteWeightB - voteWeightA) > 0.05) return voteWeightB - voteWeightA;
      return (b.popularity || 0) - (a.popularity || 0);
    });
  } else {
    // Default: 'popular'
    copy.sort((a, b) => {
      const scoreA = (a.popularity || 0) + Math.min(a.vote_count || 0, 5000) * 0.015;
      const scoreB = (b.popularity || 0) + Math.min(b.vote_count || 0, 5000) * 0.015;
      return scoreB - scoreA;
    });
  }
  return copy;
}

// ============================================================================
// POSTER CARD FOR FILMOGRAPHY RAILS & FULL FILMOGRAPHY MODAL
// ============================================================================
const FilmographyPosterCard = React.memo(function FilmographyPosterCard({
  credit,
  index,
  isGrid = false,
  onNavigate,
}: {
  credit: ActorCreditItem;
  index: number;
  isGrid?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  const posterUrl = credit.poster_path
    ? credit.poster_path.startsWith('http')
      ? credit.poster_path
      : `${IMAGE_BASE_URL_W500}${credit.poster_path}`
    : '';

  const backupUrl = credit.backdrop_path
    ? credit.backdrop_path.startsWith('http')
      ? credit.backdrop_path
      : `${IMAGE_BASE_URL_W500}${credit.backdrop_path}`
    : undefined;

  const title = credit.title || credit.name || 'Untitled';
  const rating = credit.vote_average && credit.vote_average > 0 ? Number(credit.vote_average) : null;
  const isTV = credit.media_type === 'tv';

  const handleMouseEnter = () => {
    fetchDetails(credit.id, isTV ? 'tv' : 'movie').catch(() => {});
  };

  const handleClick = () => {
    if (onNavigate) onNavigate();
    if (isTV) {
      navigate(`/watch/tv/${credit.id}`, { state: { item: credit } });
    } else {
      navigate(`/watch/movie/${credit.id}`, { state: { item: credit } });
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      className={`relative z-10 flex-shrink-0 cursor-pointer flex flex-col group transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-105 ${
        isGrid ? 'w-full' : 'w-[148px] sm:w-[168px] md:w-[184px] lg:w-[196px]'
      }`}
    >
      {/* Portrait Poster Container matching Miyoro's signature card styling */}
      <div className="relative rounded-xl overflow-hidden bg-[#141414] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] group-hover:border-white/25 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.85),0_0_25px_rgba(255,255,255,0.16)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] z-20 aspect-[2/3] w-full">
        {!imgFailed && posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading={index < 5 ? 'eager' : 'lazy'}
            decoding="async"
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
            {isTV ? (
              <TvIcon size={26} className="text-white/25 mb-2" />
            ) : (
              <MoviesIcon size={26} className="text-white/25 mb-2" />
            )}
            <span className="text-xs font-medium text-white/60 line-clamp-2">{title}</span>
          </div>
        )}

        {/* Top-left Media Type Pill */}
        <div className="absolute top-2.5 left-2.5 z-30 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/12 text-[10px] font-bold uppercase tracking-wider text-white/90 shadow-md">
            {isTV ? (
              <>
                <TvIcon size={11} className="shrink-0" />
                <span>Series</span>
              </>
            ) : (
              <>
                <MoviesIcon size={11} className="shrink-0" />
                <span>Movie</span>
              </>
            )}
          </span>
        </div>

        {/* Top-right Rating Ring */}
        <RatingRing value={rating} corner="top-right" className="z-30" />

        {/* Subtle bottom vignette on hover */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />
      </div>

      {/* Title & Character Role Meta */}
      <div className="pt-2.5 px-0.5 space-y-0.5">
        <h4
          className="text-xs sm:text-sm font-bold text-white/95 group-hover:text-white truncate transition-colors"
          title={title}
        >
          {title}
        </h4>
        <div className="flex items-center justify-between gap-2 text-[11px] text-white/50">
          <span className="truncate" title={credit.character ? `as ${credit.character}` : undefined}>
            {credit.character ? `as ${credit.character}` : isTV ? 'TV Series' : 'Feature Film'}
          </span>
          {credit.release_year && (
            <span className="shrink-0 text-white/40 font-medium">{credit.release_year}</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// SKELETON FOR PROGRESSIVE ACTOR SECTION
// ============================================================================
function ActorSectionSkeleton() {
  return (
    <div
      className="relative rounded-3xl bg-gradient-to-b from-[#111217]/90 via-[#0B0C10]/90 to-[#08090C]/90 border border-white/[0.07] p-5 sm:p-7 lg:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.75)]"
      aria-hidden="true"
    >
      <div className="flex flex-col lg:flex-row gap-7 lg:gap-10">
        {/* Left Column Skeleton */}
        <div className="w-full lg:w-[340px] xl:w-[370px] shrink-0 flex flex-col sm:flex-row lg:flex-col gap-5">
          <div className="w-36 sm:w-44 lg:w-48 aspect-[2/3] rounded-2xl bg-white/[0.06] animate-pulse shrink-0" />
          <div className="flex-1 space-y-3 pt-1">
            <div className="h-4 w-28 rounded-md bg-white/[0.06] animate-pulse" />
            <div className="h-7 w-3/4 rounded-lg bg-white/[0.08] animate-pulse" />
            <div className="h-3.5 w-1/2 rounded-md bg-white/[0.06] animate-pulse" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full rounded bg-white/[0.05] animate-pulse" />
              <div className="h-3 w-11/12 rounded bg-white/[0.05] animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-white/[0.05] animate-pulse" />
            </div>
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="h-6 w-40 rounded-lg bg-white/[0.07] animate-pulse" />
            <div className="h-8 w-48 rounded-xl bg-white/[0.05] animate-pulse" />
          </div>
          <div className="flex items-center gap-4 overflow-hidden py-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="w-[148px] sm:w-[168px] md:w-[184px] lg:w-[196px] shrink-0 space-y-2.5"
              >
                <div className="w-full aspect-[2/3] rounded-xl bg-white/[0.06] animate-pulse" />
                <div className="h-3.5 w-4/5 rounded bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INDIVIDUAL ACTOR SECTION (LEFT PROFILE + RIGHT HORIZONTAL FILMOGRAPHY)
// ============================================================================
interface ActorDiscoverSectionProps {
  actor: TrendingActorSummary;
  rank: number;
  eagerLoad: boolean;
  onOpenExpandedModal: (
    actor: TrendingActorSummary,
    details: ActorDetails | null,
    credits: ActorCreditItem[]
  ) => void;
}

const ActorDiscoverSection = React.memo(function ActorDiscoverSection({
  actor,
  rank,
  eagerLoad,
  onOpenExpandedModal,
}: ActorDiscoverSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const endSpacerRef = useRef<HTMLDivElement>(null);

  const cachedDetails = getCachedPersonDetails(actor.id);
  const cachedCredits = getCachedPersonCombinedCredits(actor.id);

  const [shouldFetch, setShouldFetch] = useState<boolean>(
    () => eagerLoad || Boolean(cachedDetails && cachedCredits)
  );
  const [details, setDetails] = useState<ActorDetails | null>(cachedDetails);
  const [credits, setCredits] = useState<ActorCreditItem[] | null>(cachedCredits);
  const [loadingData, setLoadingData] = useState<boolean>(
    () => !(cachedDetails && cachedCredits)
  );
  const [fetchError, setFetchError] = useState<boolean>(false);

  const [bioExpanded, setBioExpanded] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [sortMode, setSortMode] = useState<CreditSortMode>('popular');
  const [visibleLimit, setVisibleLimit] = useState<number>(16);

  // Horizontal rail drag & edge arrow state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);

  // Observe section visibility for progressive loading
  useEffect(() => {
    if (shouldFetch) return;
    const el = sectionRef.current;
    if (!el) return;
    observeActorSection(el, () => {
      setShouldFetch(true);
    });
    return () => {
      unobserveActorSection(el);
    };
  }, [shouldFetch]);

  const loadActorBundle = useCallback(async () => {
    setLoadingData(true);
    setFetchError(false);
    try {
      const [detRes, credRes] = await Promise.all([
        fetchPersonDetails(actor.id),
        fetchPersonCombinedCredits(actor.id),
      ]);
      setDetails(detRes);
      setCredits(credRes);
    } catch (err) {
      console.warn(`Failed loading Discover bundle for actor ${actor.id}:`, err);
      setFetchError(true);
    } finally {
      setLoadingData(false);
    }
  }, [actor.id]);

  useEffect(() => {
    if (!shouldFetch) return;
    const hitDetails = getCachedPersonDetails(actor.id);
    const hitCredits = getCachedPersonCombinedCredits(actor.id);
    if (hitDetails && hitCredits) {
      setDetails(hitDetails);
      setCredits(hitCredits);
      setLoadingData(false);
      return;
    }
    loadActorBundle();
  }, [shouldFetch, actor.id, loadActorBundle]);

  const allCredits = credits || [];

  const movieCount = useMemo(
    () => allCredits.filter((c) => c.media_type === 'movie').length,
    [allCredits]
  );
  const tvCount = useMemo(
    () => allCredits.filter((c) => c.media_type === 'tv').length,
    [allCredits]
  );

  const filteredAndSortedCredits = useMemo(() => {
    const base =
      mediaFilter === 'all'
        ? allCredits
        : allCredits.filter((c) => c.media_type === mediaFilter);
    return sortActorCredits(base, sortMode);
  }, [allCredits, mediaFilter, sortMode]);

  const railCredits = useMemo(
    () => filteredAndSortedCredits.slice(0, visibleLimit),
    [filteredAndSortedCredits, visibleLimit]
  );

  const hasMoreInRail = filteredAndSortedCredits.length > railCredits.length;

  const updateScrollEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const { scrollLeft: sl, scrollWidth, clientWidth } = el;
    setCanScrollLeft(sl > 8);
    const lastChild = endSpacerRef.current?.previousElementSibling as HTMLElement | null;
    if (lastChild && railCredits.length > 0) {
      const rightEdge = lastChild.offsetLeft + lastChild.offsetWidth;
      setCanScrollRight(sl + clientWidth < rightEdge - 8);
    } else {
      setCanScrollRight(sl + clientWidth < scrollWidth - 8);
    }
  }, [railCredits.length]);

  useLayoutEffect(() => {
    const savedX = actorRailScrollPositions.get(actor.id);
    if (savedX && railRef.current && railCredits.length > 0) {
      railRef.current.scrollLeft = savedX;
    }
    updateScrollEdges();
  }, [actor.id, railCredits.length, updateScrollEdges]);

  useEffect(() => {
    const node = railRef.current;
    if (!node) return;

    const handleScroll = () => {
      actorRailScrollPositions.set(actor.id, node.scrollLeft);
      updateScrollEdges();
    };

    node.addEventListener('scroll', handleScroll, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScrollEdges());
      ro.observe(node);
    }
    updateScrollEdges();

    return () => {
      node.removeEventListener('scroll', handleScroll);
      if (ro) ro.disconnect();
    };
  }, [actor.id, updateScrollEdges]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (railRef.current?.offsetLeft || 0));
    setScrollLeft(railRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (railRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.8;
    if (railRef.current) {
      railRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    updateScrollEdges();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cornerThreshold = Math.min(110, rect.width * 0.14);
    if (x <= cornerThreshold) {
      setHoveredEdge('left');
    } else if (x >= rect.width - cornerThreshold) {
      setHoveredEdge('right');
    } else {
      setHoveredEdge(null);
    }
  };

  const scrollByDirection = (direction: 'left' | 'right') => {
    const el = railRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.76, 320);
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  const profilePath = details?.profile_path || actor.profile_path;
  const portraitUrl = profilePath ? `${IMAGE_BASE_URL_W500}${profilePath}` : '';

  const knownForTitles = useMemo(() => {
    if (allCredits.length > 0) {
      return allCredits
        .slice(0, 3)
        .map((c) => c.title || c.name)
        .filter(Boolean);
    }
    if (Array.isArray(actor.known_for) && actor.known_for.length > 0) {
      return actor.known_for
        .map((k: any) => k?.title || k?.name)
        .filter(Boolean)
        .slice(0, 3);
    }
    return [];
  }, [allCredits, actor.known_for]);

  const biographyText = useMemo(() => {
    if (details?.biography && details.biography.length > 0) {
      return details.biography;
    }
    if (knownForTitles.length > 0) {
      return `${actor.name} is an acclaimed screen performer recognized for standout appearances in ${knownForTitles.join(', ')}.`;
    }
    return `${actor.name} is a trending performer across film and television.`;
  }, [details?.biography, actor.name, knownForTitles]);

  const hasLongBio = biographyText.length > 230;
  const popularityValue = (details?.popularity || actor.popularity || 0).toFixed(1);
  const formattedBirthday = formatBirthday(details?.birthday || null, details?.deathday || null);

  const showLeftNav = hoveredEdge === 'left' && canScrollLeft && !isDragging && railCredits.length > 0;
  const showRightNav = hoveredEdge === 'right' && canScrollRight && !isDragging && railCredits.length > 0;

  return (
    <section
      ref={sectionRef}
      aria-label={`${actor.name} filmography section`}
      className="relative rounded-3xl bg-gradient-to-b from-[#111217]/90 via-[#0B0C10]/95 to-[#07080B]/95 border border-white/[0.08] p-5 sm:p-7 lg:p-9 shadow-[0_22px_70px_rgba(0,0,0,0.85)] overflow-hidden transition-colors duration-300 hover:border-white/[0.13]"
    >
      {/* Subtle Ambient Corner Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-28 w-96 h-96 rounded-full bg-white/[0.03] blur-3xl"
      />

      <div className="relative z-10 flex flex-col lg:flex-row gap-7 lg:gap-10 xl:gap-12 items-stretch">
        {/* ================================================================ */}
        {/* LEFT COLUMN: ACTOR PORTRAIT, BIOGRAPHY & METADATA                */}
        {/* ================================================================ */}
        <div className="w-full lg:w-[330px] xl:w-[375px] shrink-0 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row lg:flex-col gap-5 sm:gap-6">
            {/* Large Integral Portrait Card */}
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => onOpenExpandedModal(actor, details, allCredits)}
                className="group/portrait relative w-36 sm:w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden bg-[#15161D] border border-white/15 shadow-[0_14px_40px_rgba(0,0,0,0.85)] hover:border-white/40 transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 shrink-0"
                aria-label={`Open full profile for ${actor.name}`}
              >
                {!portraitFailed && portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt={actor.name}
                    loading={rank <= 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/portrait:scale-105"
                    onError={() => setPortraitFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#232531] to-[#101117] text-3xl font-bold text-white/40">
                    {actor.name.charAt(0)}
                  </div>
                )}

                {/* Subtle Bottom Scrim + Expand Prompt */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-75 group-hover/portrait:opacity-90 transition-opacity" />

                {/* Trending Rank Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 text-[11px] font-bold tracking-wider text-white/90">
                  #{rank.toString().padStart(2, '0')}
                </div>

                {/* Expand Profile Pill on Portrait */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-semibold text-white/85 group-hover/portrait:text-white">
                  <span>View Full Profile</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/portrait:translate-x-0.5 group-hover/portrait:-translate-y-0.5" />
                </div>
              </button>

              {/* Mobile / Compact Quick Stats beside portrait on smallest screens */}
              <div className="flex sm:hidden flex-col gap-2 pt-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-medium text-white/75 w-fit">
                  <Sparkles className="w-3 h-3 text-white/70" />
                  <span>Popularity {popularityValue}</span>
                </div>
                <span className="text-xs font-medium text-white/50">
                  {details?.known_for_department || actor.known_for_department || 'Acting'}
                </span>
                {allCredits.length > 0 && (
                  <span className="text-xs text-white/45">
                    {allCredits.length} Titles
                  </span>
                )}
              </div>
            </div>

            {/* Actor Identity, Known-For, Metadata & Biography */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Department & Subtle Popularity Pill (Desktop / Tablet) */}
              <div className="hidden sm:flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] border border-white/10 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  {details?.known_for_department || actor.known_for_department || 'Acting'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-white/60">
                  <Sparkles className="w-3 h-3 text-white/60" />
                  <span>Popularity {popularityValue}</span>
                </span>
              </div>

              {/* Actor Name */}
              <div>
                <button
                  type="button"
                  onClick={() => onOpenExpandedModal(actor, details, allCredits)}
                  className="text-left group/name focus:outline-none cursor-pointer"
                >
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white group-hover/name:text-white/90 transition-colors">
                    {details?.name || actor.name}
                  </h2>
                </button>

                {knownForTitles.length > 0 && (
                  <p className="mt-1 text-xs sm:text-sm text-white/55 line-clamp-1">
                    <span className="text-white/40">Known for </span>
                    <span className="text-white/80 font-medium">{knownForTitles.join(' • ')}</span>
                  </p>
                )}
              </div>

              {/* Birthday & Place of Birth Metadata */}
              {(formattedBirthday || details?.place_of_birth) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/50 pt-0.5">
                  {formattedBirthday && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-white/40 shrink-0" />
                      <span>{formattedBirthday}</span>
                    </span>
                  )}
                  {details?.place_of_birth && (
                    <span className="inline-flex items-center gap-1.5 truncate max-w-full">
                      <MapPin className="w-3.5 h-3.5 text-white/40 shrink-0" />
                      <span className="truncate">{details.place_of_birth}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Biography (Clamped with inline expansion) */}
              <div className="pt-1">
                {loadingData && !details ? (
                  <div className="space-y-2 py-1">
                    <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-11/12 rounded bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-3/4 rounded bg-white/[0.06] animate-pulse" />
                  </div>
                ) : (
                  <>
                    <p
                      className={`text-xs sm:text-sm text-white/65 leading-relaxed ${
                        bioExpanded ? '' : 'line-clamp-4'
                      }`}
                    >
                      {biographyText}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-4">
                      {hasLongBio && (
                        <button
                          type="button"
                          onClick={() => setBioExpanded((prev) => !prev)}
                          className="text-xs font-semibold text-white/80 hover:text-white underline underline-offset-4 decoration-white/30 hover:decoration-white transition-colors cursor-pointer"
                        >
                          {bioExpanded ? 'Show less' : 'Read full biography'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenExpandedModal(actor, details, allCredits)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-white/65 hover:text-white transition-colors cursor-pointer"
                      >
                        <span>Explore full profile</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: HORIZONTAL FILMOGRAPHY ("MOVIES & SERIES")         */}
        {/* ================================================================ */}
        <div className="flex-1 min-w-0 flex flex-col justify-between lg:border-l lg:border-white/[0.07] lg:pl-8 xl:pl-10">
          {/* Filmography Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Movies &amp; Series
              </h3>
              {!loadingData && allCredits.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-xs font-semibold text-white/65">
                  {allCredits.length}
                </span>
              )}
            </div>

            {/* Filter & Sort Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Media Type Filter Tabs */}
              <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => {
                    setMediaFilter('all');
                    setVisibleLimit(16);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mediaFilter === 'all'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaFilter('movie');
                    setVisibleLimit(16);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mediaFilter === 'movie'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <MoviesIcon size={13} active={mediaFilter === 'movie'} />
                  <span>Movies{movieCount > 0 ? ` (${movieCount})` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaFilter('tv');
                    setVisibleLimit(16);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mediaFilter === 'tv'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <TvIcon size={13} active={mediaFilter === 'tv'} />
                  <span>Series{tvCount > 0 ? ` (${tvCount})` : ''}</span>
                </button>
              </div>

              {/* Sort Mode Selector (Popular / Newest / Top Rated / Older) */}
              <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                {(
                  [
                    { id: 'popular', label: 'Popular' },
                    { id: 'newest', label: 'Newest' },
                    { id: 'rating', label: 'Top Rated' },
                    { id: 'oldest', label: 'Older' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortMode(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      sortMode === opt.id
                        ? 'bg-[#22242E] text-white border border-white/15'
                        : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Complete Filmography Modal Trigger */}
              {allCredits.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenExpandedModal(actor, details, allCredits)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white/85 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Credits</span>
                </button>
              )}
            </div>
          </div>

          {/* Filmography Horizontal Poster Rail */}
          <div
            className="relative flex-1 flex flex-col justify-center mt-2"
            onMouseMove={handleTrackMouseMove}
            onMouseLeave={() => setHoveredEdge(null)}
          >
            {/* Left Edge Navigation Button */}
            <button
              type="button"
              aria-label={`Scroll ${actor.name} filmography left`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                scrollByDirection('left');
              }}
              className={`hidden md:flex group/nav items-center justify-start pl-3 absolute left-0 top-0 bottom-0 w-20 sm:w-24 z-[60] bg-gradient-to-r from-[#090A0E] via-[#090A0E]/80 to-transparent text-white/90 hover:text-white transition-opacity duration-200 ease-out cursor-pointer focus:outline-none ${
                showLeftNav
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <ChevronLeft className="w-7 h-7 stroke-[2.5] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-transform duration-150 group-hover/nav:scale-110 group-active/nav:scale-95" />
            </button>

            {/* Right Edge Navigation Button */}
            <button
              type="button"
              aria-label={`Scroll ${actor.name} filmography right`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                scrollByDirection('right');
              }}
              className={`hidden md:flex group/nav items-center justify-end pr-3 absolute right-0 top-0 bottom-0 w-20 sm:w-24 z-[60] bg-gradient-to-l from-[#090A0E] via-[#090A0E]/80 to-transparent text-white/90 hover:text-white transition-opacity duration-200 ease-out cursor-pointer focus:outline-none ${
                showRightNav
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <ChevronRight className="w-7 h-7 stroke-[2.5] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-transform duration-150 group-hover/nav:scale-110 group-active/nav:scale-95" />
            </button>

            {loadingData ? (
              <div className="flex items-center gap-4 overflow-hidden py-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="w-[148px] sm:w-[168px] md:w-[184px] lg:w-[196px] shrink-0 space-y-2.5"
                  >
                    <div className="w-full aspect-[2/3] rounded-xl bg-white/[0.06] animate-pulse" />
                    <div className="h-3.5 w-4/5 rounded bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
                <p className="text-sm text-white/60">
                  Unable to load filmography for {actor.name}.
                </p>
                <button
                  type="button"
                  onClick={loadActorBundle}
                  className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition-all cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : railCredits.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-sm text-white/55">
                  No {mediaFilter === 'movie' ? 'movies' : mediaFilter === 'tv' ? 'TV series' : 'credits'} found for {actor.name}.
                </p>
                {mediaFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setMediaFilter('all')}
                    className="text-xs font-semibold text-white/80 hover:text-white underline underline-offset-4 cursor-pointer"
                  >
                    Show all credits
                  </button>
                )}
              </div>
            ) : (
              <div
                ref={railRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={() => setIsDragging(false)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={handleMouseMove}
                className={`flex items-start overflow-x-auto scrollbar-hide gap-4 sm:gap-5 py-4 px-1 ${
                  isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
                }`}
              >
                {railCredits.map((credit, idx) => (
                  <FilmographyPosterCard
                    key={`${credit.media_type}_${credit.id}`}
                    credit={credit}
                    index={idx}
                  />
                ))}

                {/* End-of-Rail Card to Load More Inline or Open Full Archive */}
                {hasMoreInRail && (
                  <div className="w-[148px] sm:w-[168px] md:w-[184px] lg:w-[196px] shrink-0 flex flex-col">
                    <div className="aspect-[2/3] w-full rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center p-4 text-center gap-3">
                      <span className="text-xs font-semibold text-white/60">
                        +{filteredAndSortedCredits.length - railCredits.length} more titles
                      </span>
                      <button
                        type="button"
                        onClick={() => setVisibleLimit((prev) => prev + 16)}
                        className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all cursor-pointer"
                      >
                        Show More Here
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenExpandedModal(actor, details, allCredits)}
                        className="w-full py-2 px-3 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-bold transition-all cursor-pointer"
                      >
                        Full Archive
                      </button>
                    </div>
                  </div>
                )}

                <div ref={endSpacerRef} className="w-2 shrink-0" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

// ============================================================================
// EXPANDED ACTOR PROFILE & COMPLETE FILMOGRAPHY MODAL
// ============================================================================
interface ActorProfileModalProps {
  actor: TrendingActorSummary | null;
  initialDetails: ActorDetails | null;
  initialCredits: ActorCreditItem[];
  onClose: () => void;
}

function ActorProfileModal({
  actor,
  initialDetails,
  initialCredits,
  onClose,
}: ActorProfileModalProps) {
  const [details, setDetails] = useState<ActorDetails | null>(initialDetails);
  const [credits, setCredits] = useState<ActorCreditItem[]>(initialCredits);
  const [loading, setLoading] = useState<boolean>(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [sortMode, setSortMode] = useState<CreditSortMode>('popular');

  useEffect(() => {
    if (!actor) return;
    setDetails(initialDetails || getCachedPersonDetails(actor.id));
    const cachedCreds =
      initialCredits.length > 0 ? initialCredits : getCachedPersonCombinedCredits(actor.id) || [];
    setCredits(cachedCreds);

    if (!initialDetails || cachedCreds.length === 0) {
      let mounted = true;
      setLoading(true);
      Promise.all([
        fetchPersonDetails(actor.id),
        fetchPersonCombinedCredits(actor.id),
      ])
        .then(([d, c]) => {
          if (!mounted) return;
          setDetails(d);
          setCredits(c);
        })
        .catch(() => {})
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }
  }, [actor, initialDetails, initialCredits]);

  useEffect(() => {
    if (!actor) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actor, onClose]);

  const filteredCredits = useMemo(() => {
    const base =
      mediaFilter === 'all'
        ? credits
        : credits.filter((c) => c.media_type === mediaFilter);
    return sortActorCredits(base, sortMode);
  }, [credits, mediaFilter, sortMode]);

  if (!actor || typeof document === 'undefined') return null;

  const profilePath = details?.profile_path || actor.profile_path;
  const portraitUrl = profilePath ? `${IMAGE_BASE_URL}${profilePath}` : '';
  const formattedBirthday = formatBirthday(details?.birthday || null, details?.deathday || null);
  const movieCount = credits.filter((c) => c.media_type === 'movie').length;
  const tvCount = credits.filter((c) => c.media_type === 'tv').length;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="actor-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0D0E13]/95 border border-white/12 shadow-[0_32px_100px_rgba(0,0,0,0.95)] text-white overflow-hidden select-none"
      >
        {/* Top Modal Header */}
        <div className="px-5 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between gap-4 shrink-0 bg-black/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <DiscoverIcon size={18} active className="text-white/80 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-white/70 truncate">
              Actor Profile &amp; Complete Filmography
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/75 hover:text-white transition-all cursor-pointer shrink-0 active:scale-95"
            aria-label="Close actor profile"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 space-y-8 scrollbar-hide">
          {/* Actor Profile Hero Section */}
          <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <div className="w-36 sm:w-48 md:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-[#161821] border border-white/15 shadow-2xl shrink-0 mx-auto md:mx-0">
              {portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt={details?.name || actor.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/35">
                  {actor.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-semibold text-white/90">
                  {details?.known_for_department || actor.known_for_department || 'Acting'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs font-medium text-white/70">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Popularity {(details?.popularity || actor.popularity || 0).toFixed(1)}</span>
                </span>
                <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs font-medium text-white/70">
                  {credits.length} Acting Credits
                </span>
              </div>

              <h2
                id="actor-modal-title"
                className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white"
              >
                {details?.name || actor.name}
              </h2>

              {(formattedBirthday || details?.place_of_birth) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-white/60">
                  {formattedBirthday && (
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-white/45" />
                      <span>Born {formattedBirthday}</span>
                    </span>
                  )}
                  {details?.place_of_birth && (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-white/45" />
                      <span>{details.place_of_birth}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/45 mb-2">
                  Biography
                </h3>
                <p className="text-xs sm:text-sm text-white/75 leading-relaxed whitespace-pre-line">
                  {details?.biography ||
                    `${actor.name} is an acclaimed actor featured across movies and television series.`}
                </p>
              </div>
            </div>
          </div>

          {/* Complete Filmography Grid */}
          <div className="space-y-5 pt-4 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  Complete Filmography ({filteredCredits.length})
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Explore every movie and series appearance, from iconic hits to earliest roles
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.05] border border-white/10">
                  <button
                    type="button"
                    onClick={() => setMediaFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mediaFilter === 'all'
                        ? 'bg-white text-black'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    All ({credits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaFilter('movie')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mediaFilter === 'movie'
                        ? 'bg-white text-black'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    Movies ({movieCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaFilter('tv')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mediaFilter === 'tv'
                        ? 'bg-white text-black'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    TV Series ({tvCount})
                  </button>
                </div>

                <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.05] border border-white/10">
                  {(
                    [
                      { id: 'popular', label: 'Popular' },
                      { id: 'newest', label: 'Newest' },
                      { id: 'oldest', label: 'Oldest First' },
                      { id: 'rating', label: 'Top Rated' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortMode(opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        sortMode === opt.id
                          ? 'bg-[#22242E] text-white border border-white/15'
                          : 'text-white/55 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading && credits.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="w-full aspect-[2/3] rounded-xl bg-white/[0.06] animate-pulse" />
                    <div className="h-3.5 w-3/4 rounded bg-white/[0.06] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 pb-4">
                {filteredCredits.map((credit, idx) => (
                  <FilmographyPosterCard
                    key={`modal_${credit.media_type}_${credit.id}`}
                    credit={credit}
                    index={idx}
                    isGrid
                    onNavigate={onClose}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================================
// MAIN DISCOVER PAGE
// ============================================================================
export default function DiscoverPage() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => persistedTimeWindow);
  const [actors, setActors] = useState<TrendingActorSummary[]>(
    () => discoverBuckets[persistedTimeWindow].actors
  );
  const [hasMore, setHasMore] = useState<boolean>(
    () => discoverBuckets[persistedTimeWindow].hasMore
  );
  const [loading, setLoading] = useState<boolean>(
    () => !discoverBuckets[persistedTimeWindow].initialized
  );
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const [modalState, setModalState] = useState<{
    actor: TrendingActorSummary | null;
    details: ActorDetails | null;
    credits: ActorCreditItem[];
  }>({
    actor: null,
    details: null,
    credits: [],
  });

  const requestIdRef = useRef(0);

  // Restore scroll position when returning to DiscoverPage in the same session
  useLayoutEffect(() => {
    if (persistedWindowScrollY > 0 && discoverBuckets[timeWindow].initialized) {
      window.scrollTo(0, persistedWindowScrollY);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      persistedWindowScrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadTrendingActors = useCallback(
    async (windowMode: TimeWindow, isInitial: boolean) => {
      const bucket = discoverBuckets[windowMode];
      const reqId = ++requestIdRef.current;

      if (isInitial) {
        if (bucket.initialized && bucket.actors.length > 0) {
          setActors(bucket.actors);
          setHasMore(bucket.hasMore);
          setLoading(false);
          setError(false);
          return;
        }
        setLoading(true);
        setError(false);
      } else {
        setLoadingMore(true);
      }

      try {
        const nextPage = isInitial ? 1 : bucket.page + 1;
        const data = await fetchTrendingPeople(windowMode, nextPage);

        if (requestIdRef.current !== reqId) return;

        const existingIds = new Set(isInitial ? [] : bucket.actors.map((a) => a.id));
        const uniqueNew = data.results.filter((person) => !existingIds.has(person.id));

        const combined = isInitial ? uniqueNew : [...bucket.actors, ...uniqueNew];
        const canFetchMore = nextPage < (data.total_pages || 1);

        discoverBuckets[windowMode] = {
          actors: combined,
          page: nextPage,
          totalPages: data.total_pages || 1,
          hasMore: canFetchMore,
          initialized: true,
        };

        setActors(combined);
        setHasMore(canFetchMore);
        setError(false);
      } catch (err) {
        console.error('Failed loading trending actors:', err);
        if (requestIdRef.current === reqId && isInitial) {
          setError(true);
        }
      } finally {
        if (requestIdRef.current === reqId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    persistedTimeWindow = timeWindow;
    const bucket = discoverBuckets[timeWindow];
    if (bucket.initialized && bucket.actors.length > 0) {
      setActors(bucket.actors);
      setHasMore(bucket.hasMore);
      setLoading(false);
      setError(false);
    } else {
      loadTrendingActors(timeWindow, true);
    }
  }, [timeWindow, loadTrendingActors]);

  const handleSwitchTimeWindow = (nextWindow: TimeWindow) => {
    if (nextWindow === timeWindow) return;
    persistedWindowScrollY = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeWindow(nextWindow);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    loadTrendingActors(timeWindow, false);
  };

  const handleOpenExpandedModal = useCallback(
    (
      actor: TrendingActorSummary,
      details: ActorDetails | null,
      credits: ActorCreditItem[]
    ) => {
      setModalState({ actor, details, credits });
    },
    []
  );

  const handleCloseExpandedModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, actor: null }));
  }, []);

  return (
    <div className="min-h-screen bg-black font-sans pb-24 w-full text-white select-none relative overflow-x-hidden">
      {/* Subtle Top Cinema Ambient Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_65%_80%_at_50%_0%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_50%,transparent_100%)]"
      />

      {/* Page Header */}
      <header className="relative z-20 pt-8 sm:pt-12 pb-8 px-4 sm:px-8 lg:px-12">
        <div className="max-w-[1480px] mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-7 border-b border-white/10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-semibold text-white/75">
              <DiscoverIcon size={14} active />
              <span>Trending Talent</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold tracking-tight text-white leading-tight">
              Discover
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-white/55 max-w-xl">
              Explore the most talked-about actors right now and dive straight into the movies and series that define their screen legacy.
            </p>
          </div>

          {/* Subtle Week / Day Trending Selector */}
          <div
            className="inline-flex items-center p-1 rounded-2xl bg-[#121319] border border-white/10 self-start sm:self-auto shadow-lg"
            role="tablist"
            aria-label="Trending time window"
          >
            <button
              type="button"
              role="tab"
              aria-selected={timeWindow === 'week'}
              onClick={() => handleSwitchTimeWindow('week')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                timeWindow === 'week'
                  ? 'bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={timeWindow === 'day'}
              onClick={() => handleSwitchTimeWindow('day')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                timeWindow === 'day'
                  ? 'bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Today
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Feed of Actor Sections */}
      <main className="relative z-20 px-4 sm:px-8 lg:px-12">
        <div className="max-w-[1480px] mx-auto">
          {loading ? (
            <div className="space-y-8 sm:space-y-10">
              {Array.from({ length: 3 }, (_, i) => (
                <ActorSectionSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="py-16 flex justify-center">
              <EmptyState
                variant="error"
                title="Couldn't load trending actors"
                description="We had trouble connecting to TMDB. Please try again."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      discoverBuckets[timeWindow].initialized = false;
                      loadTrendingActors(timeWindow, true);
                    }}
                    className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs sm:text-sm hover:bg-white/90 transition-all cursor-pointer"
                  >
                    Try Again
                  </button>
                }
              />
            </div>
          ) : actors.length === 0 ? (
            <div className="py-16 flex justify-center">
              <EmptyState
                variant="search"
                title="No trending actors found"
                description="Switch between Today and This Week to explore more performers."
              />
            </div>
          ) : (
            <>
              <div className="space-y-8 sm:space-y-10">
                {actors.map((actor, index) => (
                  <ActorDiscoverSection
                    key={`${timeWindow}_${actor.id}`}
                    actor={actor}
                    rank={index + 1}
                    eagerLoad={index < 3}
                    onOpenExpandedModal={handleOpenExpandedModal}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-14 flex justify-center">
                  <LoadingButton
                    type="button"
                    loading={loadingMore}
                    onClick={handleLoadMore}
                    className="group px-8 py-3 rounded-full bg-white hover:bg-white/90 text-black font-bold text-xs sm:text-sm tracking-wide shadow-[0_6px_24px_rgba(255,255,255,0.14)] hover:shadow-[0_8px_30px_rgba(255,255,255,0.24)] active:scale-95 transition-all duration-200 cursor-pointer"
                  >
                    <span>{loadingMore ? 'Loading Actors...' : 'Load More Actors'}</span>
                    {!loadingMore && (
                      <ChevronDown className="w-4 h-4 stroke-[2.5] transition-transform duration-200 group-hover:translate-y-0.5" />
                    )}
                  </LoadingButton>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Expanded Actor Profile & Complete Filmography Overlay Modal */}
      <ActorProfileModal
        actor={modalState.actor}
        initialDetails={modalState.details}
        initialCredits={modalState.credits}
        onClose={handleCloseExpandedModal}
      />
    </div>
  );
}
