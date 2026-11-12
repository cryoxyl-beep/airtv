import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import PlatformRow from '../components/PlatformRow';
import LogoReveal from '../components/MiyoroLogoReveal';
import HeroSkeleton from '../components/MiyoroHeroSkeleton';
import { LandscapeSkeletonRow, LandscapeSkeletonSection } from '../components/MiyoroLandscapeSkeleton';
import { SkeletonRow } from '../components/MiyoroSkeletons';
import EmptyState from '../components/MiyoroEmptyStates';
import { LoadingButton } from '../components/MiyoroSpinner';
import {
  fetchTrendingAnime,
  fetchNewlyAddedAnime,
  fetchAnimeByGenre,
  fetchAnimeByTag,
  fetchTopRatedAnime,
  fetchTop100Anime
} from '../api/anilist';
import {
  fetchTrending,
  fetchTop10,
  fetchMovieTop10,
  fetchTopRatedTV,
  fetchDetails,
  fetchByGenre,
  fetchTVByGenre,
  fetchAllTimeFavorites,
  preloadLogosForItems,
  preloadImageUrls,
  getCachedLogo,
  resolveLogo,
  IMAGE_BASE_URL,
  IMAGE_BASE_URL_W500
} from '../api/tmdb';
import { dedupeItems } from '../utils/dedupe';
import { preloadHeroAmbientColors } from '../utils/ambientColor';

// Cache objects to prevent repeated loading / refetching ("not loading every time")
let cachedInitialBatch: any = null;
let initialBatchPromise: Promise<any> | null = null;
let remainingRailsPreloaded = false;
const railCache: Record<string, any[]> = {};
const tmdbGenreCache: Record<number, Promise<any>> = {};
const tmdbTVGenreCache: Record<number, Promise<any>> = {};
const anilistGenreCache: Record<string, Promise<any>> = {};
const anilistTagCache: Record<string, Promise<any>> = {};

const safeFetch = async (promiseFn: () => Promise<any>) => {
  try {
    return await promiseFn();
  } catch (e) {
    console.error("Safe fetch failed:", e);
    return { results: [] };
  }
};

const getTmdbGenre = (genreId: number) => {
  if (!tmdbGenreCache[genreId]) {
    tmdbGenreCache[genreId] = safeFetch(() => fetchByGenre(genreId));
  }
  return tmdbGenreCache[genreId];
};

const getTmdbTVGenre = (genreId: number) => {
  if (!tmdbTVGenreCache[genreId]) {
    tmdbTVGenreCache[genreId] = safeFetch(() => fetchTVByGenre(genreId));
  }
  return tmdbTVGenreCache[genreId];
};

const getAnilistGenre = (genre: string) => {
  if (!anilistGenreCache[genre]) {
    anilistGenreCache[genre] = safeFetch(() => fetchAnimeByGenre(genre, 15));
  }
  return anilistGenreCache[genre];
};

const getAnilistTag = (tag: string) => {
  if (!anilistTagCache[tag]) {
    anilistTagCache[tag] = safeFetch(() => fetchAnimeByTag(tag, 15));
  }
  return anilistTagCache[tag];
};

const mix = (tmdb: any[], anilist: any[]) => {
  const merged: any[] = [];
  const cleanTmdb = dedupeItems(tmdb || []);
  const cleanAnilist = dedupeItems(anilist || []);
  const max = Math.max(cleanTmdb.length, cleanAnilist.length);
  for (let i = 0; i < max; i++) {
    if (cleanTmdb[i]) merged.push(cleanTmdb[i]);
    if (cleanAnilist[i]) merged.push(cleanAnilist[i]);
  }
  return dedupeItems(merged);
};

// Initial lightweight critical batch: Hero items, Trending Now (top10), Suggested, Masterpieces for Home, TV, Movies, and Anime
export const preloadHomeData = async (): Promise<any> => {
  if (cachedInitialBatch) return cachedInitialBatch;
  if (initialBatchPromise) return initialBatchPromise;

  initialBatchPromise = (async () => {
    try {
      const [
        trendingData,
        top10Data,
        movieTop10Data,
        topRatedMoviesData,
        topRatedTVData,
        trendingAnimeData,
        newlyAddedAnimeData,
        topRatedAnimeData,
        top100AnimeData
      ] = await Promise.all([
        safeFetch(() => fetchTrending()),
        safeFetch(() => fetchTop10()),
        safeFetch(() => fetchMovieTop10()),
        safeFetch(() => fetchAllTimeFavorites()),
        safeFetch(() => fetchTopRatedTV()),
        safeFetch(() => fetchTrendingAnime(15)),
        safeFetch(() => fetchNewlyAddedAnime(15)),
        safeFetch(() => fetchTopRatedAnime(35)),
        safeFetch(() => fetchTop100Anime(30))
      ]);

      // 1. Anime Pool
      const animePool = dedupeItems([
        ...(trendingAnimeData.results || []),
        ...(newlyAddedAnimeData.results || [])
      ]).filter((a: any) => !(a.title && a.title.toLowerCase().includes('polar opposite')));
      const animeHeroPool = animePool.slice(0, 6);

      // 2. TV Pool
      const filteredTvTop10 = (top10Data.results || []).filter((item: any) => {
        const title = item.title || item.name || '';
        return title !== 'Tagesschau' && title !== 'Paradise Hotel';
      });
      const tvTrending = (trendingData.results || []).filter((i: any) => (i.media_type === 'tv' || i.first_air_date) && i.id);
      const tvPool = dedupeItems([
        ...filteredTvTop10,
        ...tvTrending,
        ...(topRatedTVData.results || [])
      ]).filter((item: any) => Boolean(item.backdrop_path));
      const tvHeroPool = tvPool.slice(0, 6);

      // 3. Movies Pool
      const movieTrending = (trendingData.results || []).filter((i: any) => (i.media_type === 'movie' || i.release_date) && i.id);
      const moviePool = dedupeItems([
        ...(movieTop10Data.results || []),
        ...movieTrending,
        ...(topRatedMoviesData.results || [])
      ]).filter((item: any) => Boolean(item.backdrop_path));
      const movieHeroPool = moviePool.slice(0, 6);

      // 4. Mixed Home Hero (2 anime + 2 TV + 2 movie, shuffled)
      const selectedAnime = animePool.slice(0, 2);
      const selectedTv = tvPool.slice(0, 2);
      const selectedMovie = moviePool.slice(0, 2);
      const combinedHeroItems = [...selectedAnime, ...selectedTv, ...selectedMovie];
      for (let i = combinedHeroItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinedHeroItems[i], combinedHeroItems[j]] = [combinedHeroItems[j], combinedHeroItems[i]];
      }

      // Fetch details in parallel for TV & Movies heroes, and resolve logos for anime heroes
      const [detailedHomeHero, detailedTvHero, detailedMovieHero] = await Promise.all([
        Promise.all(
          combinedHeroItems.map(async (item: any) => {
            if (item.source === 'anilist') {
              try {
                const logo = await resolveLogo(item);
                if (logo) item.logo_path = logo;
              } catch {}
              return item;
            }
            try {
              return await fetchDetails(item.id, item.media_type || (item.first_air_date ? 'tv' : 'movie'));
            } catch {
              return item;
            }
          })
        ),
        Promise.all(
          tvHeroPool.map(async (item: any) => {
            try {
              return await fetchDetails(item.id, 'tv');
            } catch {
              return item;
            }
          })
        ),
        Promise.all(
          movieHeroPool.map(async (item: any) => {
            try {
              return await fetchDetails(item.id, 'movie');
            } catch {
              return item;
            }
          })
        )
      ]);
      const detailedAnimeHero = await Promise.all(
        animeHeroPool.map(async (item: any) => {
          try {
            const logo = await resolveLogo(item);
            if (logo) item.logo_path = logo;
          } catch {}
          return item;
        })
      );

      // Populate rails
      const top10 = mix(filteredTvTop10, trendingAnimeData.results || []).slice(0, 10);
      const trending = dedupeItems(trendingData.results || []);
      const topRated = mix(topRatedMoviesData.results || [], topRatedAnimeData.results || []);

      // Home Rails
      railCache['top10'] = top10;
      railCache['trending'] = trending;
      railCache['topRated'] = topRated;

      // TV Shows Rails
      railCache['shows_top10'] = filteredTvTop10.slice(0, 10);
      railCache['shows_suggested'] = dedupeItems(tvPool).slice(2, 18);
      railCache['shows_top_rated'] = dedupeItems(topRatedTVData.results || []);

      // Movies Rails
      railCache['movies_top10'] = dedupeItems(movieTop10Data.results || []).slice(0, 10);
      railCache['movies_suggested'] = dedupeItems(moviePool).slice(2, 18);
      railCache['movies_top_rated'] = dedupeItems(topRatedMoviesData.results || []);

      // Anime Rails
      const animeTop10List = dedupeItems(trendingAnimeData.results || []).slice(0, 10);
      const top10AnimeIds = new Set(animeTop10List.map((i: any) => i.id));

      railCache['anime_top10'] = animeTop10List;
      railCache['anime_suggested'] = dedupeItems(top100AnimeData.results || []);

      // For Anime Masterpieces & Hall of Fame: start from where the results of the Top 10 anime end
      const allTopRatedAnime = dedupeItems(topRatedAnimeData.results || []);
      const masterpiecesAfterTop10 = allTopRatedAnime.slice(10).filter((i: any) => !top10AnimeIds.has(i.id));
      railCache['anime_top_rated'] = masterpiecesAfterTop10.length > 0
        ? masterpiecesAfterTop10
        : allTopRatedAnime.filter((i: any) => !top10AnimeIds.has(i.id));

      const initialData = {
        heroItems: detailedHomeHero,
        heroShows: detailedTvHero,
        heroMovies: detailedMovieHero,
        heroAnime: detailedAnimeHero,
        top10,
        trending,
        topRated,
        shows_top10: railCache['shows_top10'],
        shows_suggested: railCache['shows_suggested'],
        shows_top_rated: railCache['shows_top_rated'],
        movies_top10: railCache['movies_top10'],
        movies_suggested: railCache['movies_suggested'],
        movies_top_rated: railCache['movies_top_rated'],
        anime_top10: railCache['anime_top10'],
        anime_suggested: railCache['anime_suggested'],
        anime_top_rated: railCache['anime_top_rated']
      };

      cachedInitialBatch = initialData;

      // Warm logos & ambient colors in background for all hero entries
      const allHeroItems = [
        ...detailedHomeHero,
        ...detailedTvHero,
        ...detailedMovieHero,
        ...detailedAnimeHero
      ];
      Promise.all([
        preloadLogosForItems(allHeroItems),
        preloadHeroAmbientColors(allHeroItems)
      ]).catch(() => {});

      const criticalImageUrls: (string | null | undefined)[] = [];
      for (const h of allHeroItems.slice(0, 12)) {
        if (h?.backdrop_path) {
          criticalImageUrls.push(
            h.backdrop_path.startsWith('http') ? h.backdrop_path : `${IMAGE_BASE_URL}${h.backdrop_path}`
          );
        }
        criticalImageUrls.push(getCachedLogo(h));
        if (h?.poster_path) {
          criticalImageUrls.push(
            h.poster_path.startsWith('http') ? h.poster_path : `${IMAGE_BASE_URL_W500}${h.poster_path}`
          );
        }
      }
      preloadImageUrls(criticalImageUrls, 600).catch(() => {});

      return initialData;
    } catch (err) {
      console.error("Failed to load initial Home data", err);
      return null;
    } finally {
      initialBatchPromise = null;
    }
  })();

  return initialBatchPromise;
};

// Lazy loaded individual rail: renders real Row if cached/loaded and near viewport, otherwise lightweight placeholder / skeleton
interface LazyRailProps {
  title: string;
  railKey: string;
  isTop10?: boolean;
  eager?: boolean;
  loadItems: () => Promise<any[]>;
  initialItems?: any[];
}

const railPromises: Record<string, Promise<any[]>> = {};

const LazyRail = React.memo(function LazyRail({ title, railKey, isTop10 = false, eager = false, loadItems, initialItems }: LazyRailProps) {
  const [items, setItems] = useState<any[] | null>(() => {
    if (initialItems && initialItems.length > 0) {
      railCache[railKey] = initialItems;
      return initialItems;
    }
    return railCache[railKey] || null;
  });

  const [isNearViewport, setIsNearViewport] = useState<boolean>(eager);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const loadItemsRef = useRef(loadItems);
  loadItemsRef.current = loadItems;

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      railCache[railKey] = initialItems;
      setItems(initialItems);
    }
  }, [initialItems, railKey]);

  const triggerLoad = useCallback(() => {
    if (railCache[railKey] && railCache[railKey].length > 0) {
      setItems(railCache[railKey]);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!railPromises[railKey]) {
      railPromises[railKey] = loadItemsRef.current()
        .then((res) => {
          railCache[railKey] = res || [];
          return res || [];
        })
        .catch((err) => {
          console.error(`Failed loading rail ${railKey}:`, err);
          return [];
        });
    }

    railPromises[railKey].then((res) => {
      setItems(res);
      isFetchingRef.current = false;
    });
  }, [railKey]);

  useEffect(() => {
    if (isNearViewport && items && items.length > 0) return;
    if (isNearViewport && railCache[railKey] && railCache[railKey].length > 0) {
      setItems(railCache[railKey]);
      return;
    }

    const node = containerRef.current;
    if (!node) {
      if (isNearViewport) triggerLoad();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsNearViewport(true);
          triggerLoad();
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [railKey, triggerLoad, items, isNearViewport]);

  if (!isNearViewport) {
    return <div ref={containerRef} className="w-full min-h-[250px]" aria-hidden="true" />;
  }

  if (items && items.length > 0) {
    return <Row title={title} items={items} isTop10={isTop10} />;
  }

  // Loading skeleton placeholder:
  // Trending Now has portrait posters -> use the portrait SkeletonRow from MiyoroSkeletons
  // Other rails have landscape cards -> use LandscapeSkeletonSection + LandscapeSkeletonRow with real width (300) and gap (16)
  return (
    <div ref={containerRef} className="pl-6 md:pl-12 pr-6 md:pr-12">
      {isTop10 ? (
        <LandscapeSkeletonSection>
          <SkeletonRow count={6} cardWidth={175} />
        </LandscapeSkeletonSection>
      ) : (
        <LandscapeSkeletonSection>
          <LandscapeSkeletonRow count={6} cardWidth={300} gap={16} />
        </LandscapeSkeletonSection>
      )}
    </div>
  );
});

let hasShownHomeReveal = typeof window !== 'undefined' && sessionStorage.getItem('miyoro_has_shown_reveal') === 'true';

export const markHomeRevealShown = () => {
  hasShownHomeReveal = true;
  try {
    sessionStorage.setItem('miyoro_has_shown_reveal', 'true');
  } catch (e) {}
};

interface HomeProps {
  typeFilter?: 'shows' | 'movies' | 'anime' | 'sports' | 'sparks' | 'categories';
  isActive?: boolean;
}

export default function Home({ typeFilter, isActive = true }: HomeProps = {}) {
  // Only ever show LogoReveal on initial cold landing directly on /home if never seen in session
  const isHomeVisit = isActive && (!typeFilter || window.location.pathname === '/home');
  const shouldReveal = isHomeVisit && !hasShownHomeReveal;

  const [showOverlay, setShowOverlay] = useState(shouldReveal);
  const [overlayFading, setOverlayFading] = useState(false);
  const [revealRound, setRevealRound] = useState(0);

  const [homeReady, setHomeReady] = useState(Boolean(cachedInitialBatch));
  const homeReadyRef = useRef(Boolean(cachedInitialBatch));
  const [loadError, setLoadError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const [initialData, setInitialData] = useState<any>(cachedInitialBatch || {
    heroItems: [],
    trending: [],
    top10: [],
    topRated: []
  });

  const handleRevealDone = () => {
    if (homeReadyRef.current) {
      markHomeRevealShown();
      setOverlayFading(true);
      setTimeout(() => {
        setShowOverlay(false);
      }, 250);
    } else {
      setRevealRound((r) => r + 1);
    }
  };

  useEffect(() => {
    if (!showOverlay) return;

    const safetyTimer = setTimeout(() => {
      markHomeRevealShown();
      setShowOverlay(false);
      if (!homeReadyRef.current) {
        setLoadError(true);
      }
    }, 3000);

    return () => clearTimeout(safetyTimer);
  }, [showOverlay]);

  const loadInitial = useCallback(() => {
    if (cachedInitialBatch) {
      setInitialData(cachedInitialBatch);
      homeReadyRef.current = true;
      setHomeReady(true);
      return;
    }

    preloadHomeData()
      .then((loaded) => {
        if (loaded) {
          setInitialData(loaded);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load initial Home data:', err);
        setLoadError(true);
      })
      .finally(() => {
        homeReadyRef.current = true;
        setHomeReady(true);
      });
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleRetry = () => {
    setIsRetrying(true);
    setLoadError(false);
    preloadHomeData()
      .then((loaded) => {
        if (loaded) {
          setInitialData(loaded);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => {
        setIsRetrying(false);
        homeReadyRef.current = true;
        setHomeReady(true);
      });
  };

  const heroItems = useMemo(() => {
    if (!initialData) return [];
    if (typeFilter === 'shows') {
      if (initialData.heroShows && initialData.heroShows.length > 0) {
        return initialData.heroShows;
      }
      const shows = (initialData.heroItems || []).filter(
        (i: any) => i.media_type === 'tv' || i.first_air_date || i.number_of_seasons
      );
      return shows.length > 0 ? shows : initialData.heroItems || [];
    }
    if (typeFilter === 'movies') {
      if (initialData.heroMovies && initialData.heroMovies.length > 0) {
        return initialData.heroMovies;
      }
      const movies = (initialData.heroItems || []).filter(
        (i: any) => i.media_type === 'movie' || i.release_date
      );
      return movies.length > 0 ? movies : initialData.heroItems || [];
    }
    if (typeFilter === 'anime') {
      if (initialData.heroAnime && initialData.heroAnime.length > 0) {
        return initialData.heroAnime;
      }
      const animes = (initialData.heroItems || []).filter(
        (i: any) => i.source === 'anilist' || i.anime_format
      );
      return animes.length > 0 ? animes : initialData.heroItems || [];
    }
    return initialData.heroItems || [];
  }, [initialData, typeFilter]);

  // Gentle background preloader: after initial fold loads, sequentially warm remaining rails
  useEffect(() => {
    if (!homeReady || loadError || remainingRailsPreloaded) return;

    const remainingLoaders = [
      // TV categories
      () => getTmdbTVGenre(18).then(t => { railCache['shows_drama'] = dedupeItems(t.results || []); }),
      () => getTmdbTVGenre(80).then(t => { railCache['shows_crime'] = dedupeItems(t.results || []); }),
      () => getTmdbTVGenre(10765).then(t => { railCache['shows_scifi'] = dedupeItems(t.results || []); }),
      () => getTmdbTVGenre(10759).then(t => { railCache['shows_action'] = dedupeItems(t.results || []); }),
      () => getTmdbTVGenre(35).then(t => { railCache['shows_comedy'] = dedupeItems(t.results || []); }),
      () => getTmdbTVGenre(9648).then(t => { railCache['shows_mystery'] = dedupeItems(t.results || []); }),
      () => getTmdbTVGenre(99).then(t => { railCache['shows_documentary'] = dedupeItems(t.results || []); }),
      () => getTmdbTVGenre(16).then(t => { railCache['shows_animation'] = dedupeItems(t.results || []); }),
      // Movie categories
      () => getTmdbGenre(28).then(t => { railCache['movies_action'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(12).then(t => { railCache['movies_adventure'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(878).then(t => { railCache['movies_scifi'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(53).then(t => { railCache['movies_thriller'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(27).then(t => { railCache['movies_horror'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(80).then(t => { railCache['movies_crime'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(35).then(t => { railCache['movies_comedy'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(10749).then(t => { railCache['movies_romance'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(18).then(t => { railCache['movies_drama'] = dedupeItems(t.results || []); }),
      () => getTmdbGenre(14).then(t => { railCache['movies_fantasy'] = dedupeItems(t.results || []); }),
      // Anime categories
      () => getAnilistGenre('Action').then(a => { railCache['anime_action'] = dedupeItems(a.results || []); }),
      () => getAnilistTag('Isekai').then(a => { railCache['anime_isekai'] = dedupeItems(a.results || []); }),
      () => getAnilistGenre('Supernatural').then(a => { railCache['anime_supernatural'] = dedupeItems(a.results || []); }),
      () => getAnilistGenre('Psychological').then(a => { railCache['anime_psychological'] = dedupeItems(a.results || []); }),
      () => getAnilistGenre('Mecha').then(a => { railCache['anime_mecha'] = dedupeItems(a.results || []); }),
      () => getAnilistGenre('Slice of Life').then(a => { railCache['anime_slice_of_life'] = dedupeItems(a.results || []); }),
      () => getAnilistGenre('Romance').then(a => { railCache['anime_romance'] = dedupeItems(a.results || []); }),
      () => getAnilistTag('School').then(a => { railCache['anime_school'] = dedupeItems(a.results || []); }),
      // Home mixed categories
      () => Promise.all([getTmdbGenre(28), getAnilistGenre('Action')]).then(([t, a]) => { railCache['action'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(12), getAnilistGenre('Adventure')]).then(([t, a]) => { railCache['adventure'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(878), getAnilistGenre('Sci-Fi')]).then(([t, a]) => { railCache['scifi'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(27), getAnilistGenre('Horror')]).then(([t, a]) => { railCache['horror'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(35), getAnilistGenre('Comedy')]).then(([t, a]) => { railCache['comedy'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(10749), getAnilistGenre('Romance')]).then(([t, a]) => { railCache['romance'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(18), getAnilistGenre('Drama')]).then(([t, a]) => { railCache['drama'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(99), getAnilistGenre('Drama')]).then(([t, a]) => { railCache['documentary'] = mix(t.results, a.results?.slice(6)); }),
      () => Promise.all([getTmdbGenre(10402), getAnilistGenre('Music')]).then(([t, a]) => { railCache['music'] = mix(t.results, a.results); })
    ];

    let timerId: any = null;
    let step = 0;

    const runNext = () => {
      if (step >= remainingLoaders.length) {
        remainingRailsPreloaded = true;
        return;
      }
      const loader = remainingLoaders[step];
      step++;
      loader().catch(() => {}).finally(() => {
        timerId = setTimeout(runNext, 350);
      });
    };

    timerId = setTimeout(runNext, 400);

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [homeReady, loadError]);

  return (
    <div className={`min-h-screen bg-transparent pb-20 font-sans w-full ${isActive ? 'block' : 'hidden'}`}>
      {/* 1. Full-screen LogoReveal Overlay on /home */}
      {isActive && showOverlay && (
        <div 
          className={`fixed inset-0 z-[9999] bg-black text-white flex items-center justify-center transition-opacity duration-300 ease-out pointer-events-auto ${
            overlayFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-hidden={overlayFading}
        >
          <LogoReveal key={revealRound} size={160} onDone={handleRevealDone} />
        </div>
      )}

      {/* Error State with Retry Button */}
      {homeReady && loadError && (
        <div className="py-20 px-4 flex flex-col items-center">
          <EmptyState
            variant="error"
            action={
              <LoadingButton
                loading={isRetrying}
                onClick={handleRetry}
                className="px-6 py-2.5 rounded-full bg-white text-black font-bold hover:bg-white/90 transition-all text-sm cursor-pointer shadow-lg"
              >
                Try again
              </LoadingButton>
            }
          />
        </div>
      )}

      {/* Main Home Content */}
      {(!loadError) && (
        <>
          {/* Hero Billboard: Show <HeroSkeleton /> while the hero banner is loading */}
          {(!heroItems || heroItems.length === 0) ? (
            <section className="w-full px-4 sm:px-8 lg:px-[56px] pt-4 sm:pt-6 md:pt-[28px] select-none">
              <HeroSkeleton height="70vh" />
            </section>
          ) : (
            <Hero items={heroItems} isActive={isActive} />
          )}

          {/* Content Feed with Continuous, Spaced Categories */}
          <div className="relative z-20 flex flex-col gap-4 pt-8 md:pt-10">
            {typeFilter === 'shows' && (
              <>
                <LazyRail
                  title="Trending Now in TV"
                  railKey="shows_top10"
                  isTop10={true}
                  eager={true}
                  initialItems={initialData.shows_top10}
                  loadItems={async () => {
                    const t = await safeFetch(fetchTop10);
                    return (t.results || []).filter((i: any) => {
                      const title = i.title || i.name || '';
                      return title !== 'Tagesschau' && title !== 'Paradise Hotel';
                    }).slice(0, 10);
                  }}
                />
                <LazyRail
                  title="Suggested TV Series"
                  railKey="shows_suggested"
                  eager={true}
                  initialItems={initialData.shows_suggested}
                  loadItems={async () => {
                    const t = await safeFetch(fetchTrending);
                    return dedupeItems((t.results || []).filter((i: any) => i.media_type === 'tv' || i.first_air_date));
                  }}
                />
                <LazyRail
                  title="Masterpiece Series & Hall of Fame"
                  railKey="shows_top_rated"
                  initialItems={initialData.shows_top_rated}
                  loadItems={async () => {
                    const t = await safeFetch(fetchTopRatedTV);
                    return dedupeItems(t.results || []);
                  }}
                />
                <PlatformRow />
                <LazyRail
                  title="Bingeable Drama Series"
                  railKey="shows_drama"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(18);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Crime, Heists & Underworld"
                  railKey="shows_crime"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(80);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Sci-Fi & Fantasy Series"
                  railKey="shows_scifi"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(10765);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Action & Adventure Series"
                  railKey="shows_action"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(10759);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Sitcoms & Comfort Comedy"
                  railKey="shows_comedy"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(35);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Mystery & Mind Games"
                  railKey="shows_mystery"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(9648);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Docuseries & Real Stories"
                  railKey="shows_documentary"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(99);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Animated TV & Family Classics"
                  railKey="shows_animation"
                  loadItems={async () => {
                    const t = await getTmdbTVGenre(16);
                    return dedupeItems(t.results || []);
                  }}
                />
              </>
            )}

            {typeFilter === 'movies' && (
              <>
                <LazyRail
                  title="Trending Now in Movies"
                  railKey="movies_top10"
                  isTop10={true}
                  eager={true}
                  initialItems={initialData.movies_top10}
                  loadItems={async () => {
                    const t = await safeFetch(fetchMovieTop10);
                    return dedupeItems(t.results || []).slice(0, 10);
                  }}
                />
                <LazyRail
                  title="Suggested Movies For You"
                  railKey="movies_suggested"
                  eager={true}
                  initialItems={initialData.movies_suggested}
                  loadItems={async () => {
                    const t = await safeFetch(fetchTrending);
                    return dedupeItems((t.results || []).filter((i: any) => i.media_type === 'movie' || i.release_date));
                  }}
                />
                <LazyRail
                  title="Cinema Masterpieces & Hall of Fame"
                  railKey="movies_top_rated"
                  initialItems={initialData.movies_top_rated}
                  loadItems={async () => {
                    const t = await safeFetch(fetchAllTimeFavorites);
                    return dedupeItems(t.results || []);
                  }}
                />
                <PlatformRow />
                <LazyRail
                  title="Blockbuster Action & Combat"
                  railKey="movies_action"
                  loadItems={async () => {
                    const t = await getTmdbGenre(28);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Grand Adventures & Quests"
                  railKey="movies_adventure"
                  loadItems={async () => {
                    const t = await getTmdbGenre(12);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Sci-Fi & Cyber Visions"
                  railKey="movies_scifi"
                  loadItems={async () => {
                    const t = await getTmdbGenre(878);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Mind-Bending & Psychological Thrillers"
                  railKey="movies_thriller"
                  loadItems={async () => {
                    const t = await getTmdbGenre(53);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Horror & Dark Nightmares"
                  railKey="movies_horror"
                  loadItems={async () => {
                    const t = await getTmdbGenre(27);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Crime, Heists & Mobsters"
                  railKey="movies_crime"
                  loadItems={async () => {
                    const t = await getTmdbGenre(80);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Comedies & Laughs"
                  railKey="movies_comedy"
                  loadItems={async () => {
                    const t = await getTmdbGenre(35);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Romance & Heartstrings"
                  railKey="movies_romance"
                  loadItems={async () => {
                    const t = await getTmdbGenre(10749);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Gripping Dramas & Deep Stories"
                  railKey="movies_drama"
                  loadItems={async () => {
                    const t = await getTmdbGenre(18);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Epic Fantasy & Mythic Quests"
                  railKey="movies_fantasy"
                  loadItems={async () => {
                    const t = await getTmdbGenre(14);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Family & Heartfelt Animation"
                  railKey="movies_family"
                  loadItems={async () => {
                    const t = await getTmdbGenre(10751);
                    return dedupeItems(t.results || []);
                  }}
                />
                <LazyRail
                  title="Real Stories & Documentaries"
                  railKey="movies_documentary"
                  loadItems={async () => {
                    const t = await getTmdbGenre(99);
                    return dedupeItems(t.results || []);
                  }}
                />
              </>
            )}

            {typeFilter === 'anime' && (
              <>
                <LazyRail
                  title="Top 10 Trending Anime"
                  railKey="anime_top10"
                  isTop10={true}
                  eager={true}
                  initialItems={initialData.anime_top10}
                  loadItems={async () => {
                    const a = await safeFetch(() => fetchTrendingAnime(15));
                    return dedupeItems(a.results || []).slice(0, 10);
                  }}
                />
                <LazyRail
                  title="Suggested Anime For You"
                  railKey="anime_suggested"
                  eager={true}
                  initialItems={initialData.anime_suggested}
                  loadItems={async () => {
                    const a = await safeFetch(() => fetchTop100Anime(30));
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Anime Masterpieces & Hall of Fame"
                  railKey="anime_top_rated"
                  initialItems={initialData.anime_top_rated}
                  loadItems={async () => {
                    const [top10Res, topRatedRes] = await Promise.all([
                      safeFetch(() => fetchTrendingAnime(15)),
                      safeFetch(() => fetchTopRatedAnime(35))
                    ]);
                    const top10List = dedupeItems(top10Res.results || []).slice(0, 10);
                    const top10Ids = new Set(top10List.map((i: any) => i.id));
                    const allTopRated = dedupeItems(topRatedRes.results || []);
                    const afterTop10 = allTopRated.slice(10).filter((i: any) => !top10Ids.has(i.id));
                    return afterTop10.length > 0 ? afterTop10 : allTopRated.filter((i: any) => !top10Ids.has(i.id));
                  }}
                />
                <LazyRail
                  title="Shonen & High-Octane Action"
                  railKey="anime_action"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Action');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Isekai & Alternate Worlds"
                  railKey="anime_isekai"
                  loadItems={async () => {
                    const a = await getAnilistTag('Isekai');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Supernatural & Dark Fantasy"
                  railKey="anime_supernatural"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Supernatural');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Mind-Bending & Psychological Thrillers"
                  railKey="anime_psychological"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Psychological');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Mecha, Tech & Cyberpunk"
                  railKey="anime_mecha"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Mecha');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Warm & Cozy: Slice of Life"
                  railKey="anime_slice_of_life"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Slice of Life');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Romance & Heartstrings"
                  railKey="anime_romance"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Romance');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="High School & Campus Life"
                  railKey="anime_school"
                  loadItems={async () => {
                    const a = await getAnilistTag('School');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Sports & Fierce Rivalries"
                  railKey="anime_sports"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Sports');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Horror & Macabre Nightmares"
                  railKey="anime_horror"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Horror');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Grand Adventure & Quests"
                  railKey="anime_adventure"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Adventure');
                    return dedupeItems(a.results || []);
                  }}
                />
                <LazyRail
                  title="Pure Comedy & Laughs"
                  railKey="anime_comedy"
                  loadItems={async () => {
                    const a = await getAnilistGenre('Comedy');
                    return dedupeItems(a.results || []);
                  }}
                />
              </>
            )}

            {(!typeFilter || (typeFilter !== 'shows' && typeFilter !== 'movies' && typeFilter !== 'anime')) && (
              <>
                {/* Ranked Spotlight: Trending Now (Portrait posters -> uses portrait skeleton loader) */}
                <LazyRail
                  title="Trending Now"
                  railKey="top10"
                  isTop10={true}
                  eager={true}
                  initialItems={initialData.top10}
                  loadItems={async () => {
                    const [t, a] = await Promise.all([safeFetch(fetchTop10), safeFetch(() => fetchTrendingAnime(15))]);
                    const filtered = (t.results || []).filter((item: any) => {
                      const title = item.title || item.name || '';
                      return title !== 'Tagesschau' && title !== 'Paradise Hotel';
                    });
                    return mix(filtered, a.results || []).slice(0, 10);
                  }}
                />

                {/* Curated Recommendations */}
                <LazyRail
                  title="Suggested For You"
                  railKey="trending"
                  eager={true}
                  initialItems={initialData.trending?.slice(4)}
                  loadItems={async () => {
                    const t = await safeFetch(fetchTrending);
                    return dedupeItems(t.results || []).slice(4);
                  }}
                />

                {/* All-Time Critically Acclaimed */}
                <LazyRail
                  title="Masterpieces & Hall of Fame"
                  railKey="topRated"
                  initialItems={initialData.topRated}
                  loadItems={async () => {
                    const [t, a] = await Promise.all([safeFetch(fetchAllTimeFavorites), safeFetch(() => fetchTopRatedAnime(15))]);
                    return mix(t.results, a.results);
                  }}
                />

                {/* Streaming Providers */}
                <PlatformRow />

                {/* High Energy & Combat */}
                <LazyRail
                  title="Action & Adventure"
                  railKey="action"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(28), getAnilistGenre('Action')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Martial Arts & Hand-to-Hand Combat"
                  railKey="martialArts"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(28), getAnilistTag('Martial Arts')]);
                    return mix(t.results?.slice(8), a.results);
                  }}
                />
                <LazyRail
                  title="Grand Adventures & Quests"
                  railKey="adventure"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(12), getAnilistGenre('Adventure')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="High-Octane Sports & Rivalries"
                  railKey="sports"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(28), getAnilistGenre('Sports')]);
                    return mix(t.results?.slice(8), a.results);
                  }}
                />
                <LazyRail
                  title="Mecha, Tech & Future Warfare"
                  railKey="mecha"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(878), getAnilistGenre('Mecha')]);
                    return mix(t.results?.slice(8), a.results);
                  }}
                />

                {/* Supernatural, Fantasy & Sci-Fi */}
                <LazyRail
                  title="Supernatural & Dark Fantasy"
                  railKey="supernatural"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(14), getAnilistGenre('Supernatural')]);
                    return mix(t.results?.slice(6), a.results);
                  }}
                />
                <LazyRail
                  title="Isekai & Alternate Realities"
                  railKey="isekai"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(12), getAnilistTag('Isekai')]);
                    return mix(t.results?.slice(6), a.results);
                  }}
                />
                <LazyRail
                  title="Sci-Fi & Cyber Realms"
                  railKey="scifi"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(878), getAnilistGenre('Sci-Fi')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Cyberpunk & Dystopian Visions"
                  railKey="cyberpunk"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(878), getAnilistTag('Cyberpunk')]);
                    return mix(t.results?.slice(6), a.results);
                  }}
                />
                <LazyRail
                  title="Epic Fantasy & Mythic Worlds"
                  railKey="fantasy"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(14), getAnilistGenre('Fantasy')]);
                    return mix(t.results, a.results);
                  }}
                />

                {/* Survival, Thrillers & Suspense */}
                <LazyRail
                  title="Survival Games & Apocalyptic Worlds"
                  railKey="survival"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(53), getAnilistTag('Survival')]);
                    return mix(t.results?.slice(6), a.results);
                  }}
                />
                <LazyRail
                  title="Horror & Dark Nightmares"
                  railKey="horror"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(27), getAnilistGenre('Horror')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Mind-Bending & Psychological Thrillers"
                  railKey="thriller"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(53), getAnilistGenre('Psychological')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Mystery & Whodunits"
                  railKey="mystery"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(9648), getAnilistGenre('Mystery')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Espionage, War & Tactical Battles"
                  railKey="military"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(10752), getAnilistTag('Military')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Crime, Heists & Underworld"
                  railKey="crime"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(80), getAnilistGenre('Mystery')]);
                    return mix(t.results, a.results?.slice(6));
                  }}
                />

                {/* Comedy, Campus & Comfort */}
                <LazyRail
                  title="Comedies & Laughs"
                  railKey="comedy"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(35), getAnilistGenre('Comedy')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Campus Life & High School Dramas"
                  railKey="teen"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(35), getAnilistTag('School')]);
                    return mix(t.results?.slice(6), a.results);
                  }}
                />
                <LazyRail
                  title="Sitcoms & Bingeable Comfort"
                  railKey="sitcom"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbTVGenre(35), getAnilistGenre('Comedy')]);
                    return mix(t.results, a.results?.slice(6));
                  }}
                />
                <LazyRail
                  title="Warm & Cozy: Slice of Life"
                  railKey="sliceOfLife"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(10751), getAnilistGenre('Slice of Life')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Family & Heartfelt Animation"
                  railKey="family"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(10751), getAnilistGenre('Adventure')]);
                    return mix(t.results, a.results?.slice(6));
                  }}
                />

                {/* Romance, Drama, Docs & Music */}
                <LazyRail
                  title="Romance & Heartstrings"
                  railKey="romance"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(10749), getAnilistGenre('Romance')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Gripping Drama & Emotional Tales"
                  railKey="drama"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(18), getAnilistGenre('Drama')]);
                    return mix(t.results, a.results);
                  }}
                />
                <LazyRail
                  title="Real Stories & Documentaries"
                  railKey="documentary"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(99), getAnilistGenre('Drama')]);
                    return mix(t.results, a.results?.slice(6));
                  }}
                />
                <LazyRail
                  title="Musical & Rhythmic Spotlight"
                  railKey="music"
                  loadItems={async () => {
                    const [t, a] = await Promise.all([getTmdbGenre(10402), getAnilistGenre('Music')]);
                    return mix(t.results, a.results);
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
