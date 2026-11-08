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
  fetchTopRatedAnime
} from '../api/anilist';
import {
  fetchTrending,
  fetchTop10,
  fetchDetails,
  fetchByGenre,
  fetchTVByGenre,
  fetchAllTimeFavorites,
  preloadLogosForItems,
  preloadImageUrls,
  getCachedLogo,
  IMAGE_BASE_URL,
  IMAGE_BASE_URL_W500
} from '../api/tmdb';
import { dedupeItems } from '../utils/dedupe';

// Cache objects to prevent repeated loading / refetching ("not loading every time")
let cachedInitialBatch: any = null;
let initialBatchPromise: Promise<any> | null = null;
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

// Initial lightweight critical batch: Hero items, Trending Now (top10), Suggested (trending), Masterpieces (topRated)
export const preloadHomeData = async (): Promise<any> => {
  if (cachedInitialBatch) return cachedInitialBatch;
  if (initialBatchPromise) return initialBatchPromise;

  initialBatchPromise = (async () => {
    try {
      const [
        trendingData,
        top10Data,
        topRatedMoviesData,
        trendingAnimeData,
        newlyAddedAnimeData,
        topRatedAnimeData
      ] = await Promise.all([
        safeFetch(() => fetchTrending()),
        safeFetch(() => fetchTop10()),
        safeFetch(() => fetchAllTimeFavorites()),
        safeFetch(() => fetchTrendingAnime(15)),
        safeFetch(() => fetchNewlyAddedAnime(15)),
        safeFetch(() => fetchTopRatedAnime(15))
      ]);

      // Assemble Hero with deduplicated anime
      const animePool = dedupeItems([
        ...(trendingAnimeData.results || []),
        ...(newlyAddedAnimeData.results || [])
      ]).filter((a: any) => !(a.title && a.title.toLowerCase().includes('polar opposite')));

      const selectedAnime = animePool.slice(0, 3);
      const tvPool = (trendingData.results || []).filter((i: any) => i.media_type === 'tv' && i.id);
      const moviePool = (trendingData.results || []).filter((i: any) => i.media_type === 'movie' && i.id);

      const selectedTv = tvPool.slice(0, 3);
      const selectedMovie = moviePool.slice(0, 4);

      const combinedHeroItems = [...selectedAnime, ...selectedTv, ...selectedMovie];

      for (let i = combinedHeroItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinedHeroItems[i], combinedHeroItems[j]] = [combinedHeroItems[j], combinedHeroItems[i]];
      }

      const detailedHeroItems = await Promise.all(
        combinedHeroItems.map(async (item: any) => {
          if (item.source === 'anilist') return item;
          try {
            return await fetchDetails(item.id, item.media_type || 'movie');
          } catch (e) {
            return item;
          }
        })
      );

      const filteredTop10 = (top10Data.results || []).filter((item: any) => {
        const title = item.title || item.name || '';
        return title !== 'Tagesschau' && title !== 'Paradise Hotel';
      });

      const top10 = mix(filteredTop10, trendingAnimeData.results || []).slice(0, 10);
      const trending = dedupeItems(trendingData.results || []);
      const topRated = mix(topRatedMoviesData.results || [], topRatedAnimeData.results || []);

      railCache['top10'] = top10;
      railCache['trending'] = trending;
      railCache['topRated'] = topRated;

      const initialData = {
        heroItems: detailedHeroItems,
        top10,
        trending,
        topRated
      };

      // Resolve clear logos for top visible items first
      const priorityItems = detailedHeroItems.slice(0, 4);
      await Promise.race([
        preloadLogosForItems(priorityItems),
        new Promise(r => setTimeout(r, 400))
      ]);

      // Preload critical image bytes into browser GPU cache
      const criticalImageUrls: (string | null | undefined)[] = [];
      const firstHero = detailedHeroItems[0];
      if (firstHero) {
        if (firstHero.backdrop_path) {
          criticalImageUrls.push(
            firstHero.backdrop_path.startsWith('http')
              ? firstHero.backdrop_path
              : `${IMAGE_BASE_URL}${firstHero.backdrop_path}`
          );
        }
        criticalImageUrls.push(getCachedLogo(firstHero));
      }

      for (const h of detailedHeroItems) {
        if (h?.poster_path) {
          criticalImageUrls.push(
            h.poster_path.startsWith('http') ? h.poster_path : `${IMAGE_BASE_URL_W500}${h.poster_path}`
          );
        }
      }

      for (const card of (top10.slice(0, 6) as any[])) {
        if (card?.backdrop_path) {
          criticalImageUrls.push(
            card.backdrop_path.startsWith('http') ? card.backdrop_path : `${IMAGE_BASE_URL_W500}${card.backdrop_path}`
          );
        }
        criticalImageUrls.push(getCachedLogo(card));
      }

      await preloadImageUrls(criticalImageUrls, 600);

      cachedInitialBatch = initialData;
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

// Lazy loaded individual rail: renders real Row if cached/loaded, otherwise skeleton
interface LazyRailProps {
  title: string;
  railKey: string;
  isTop10?: boolean;
  loadItems: () => Promise<any[]>;
  initialItems?: any[];
}

const railPromises: Record<string, Promise<any[]>> = {};

function LazyRail({ title, railKey, isTop10 = false, loadItems, initialItems }: LazyRailProps) {
  const [items, setItems] = useState<any[] | null>(() => {
    if (initialItems && initialItems.length > 0) {
      railCache[railKey] = initialItems;
      return initialItems;
    }
    return railCache[railKey] || null;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (initialItems && initialItems.length > 0 && (!items || items.length === 0)) {
      railCache[railKey] = initialItems;
      setItems(initialItems);
    }
  }, [initialItems, railKey, items]);

  const triggerLoad = useCallback(() => {
    if (railCache[railKey] && railCache[railKey].length > 0) {
      setItems(railCache[railKey]);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!railPromises[railKey]) {
      railPromises[railKey] = loadItems()
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
  }, [railKey, loadItems]);

  useEffect(() => {
    if (items && items.length > 0) return;
    if (railCache[railKey] && railCache[railKey].length > 0) {
      setItems(railCache[railKey]);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          triggerLoad();
          observer.disconnect();
        }
      },
      { rootMargin: '1000px' }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [railKey, triggerLoad, items]);

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
}

let hasShownHomeReveal = false;

interface HomeProps {
  typeFilter?: 'shows' | 'movies' | 'anime' | 'sports' | 'sparks' | 'categories';
}

export default function Home({ typeFilter }: HomeProps = {}) {
  const isHomeVisit = !typeFilter || window.location.pathname === '/home';
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
      hasShownHomeReveal = true;
      setOverlayFading(true);
      setTimeout(() => {
        setShowOverlay(false);
      }, 300);
    } else {
      setRevealRound((r) => r + 1);
    }
  };

  useEffect(() => {
    if (!showOverlay) return;

    const safetyTimer = setTimeout(() => {
      hasShownHomeReveal = true;
      setShowOverlay(false);
      if (!homeReadyRef.current) {
        setLoadError(true);
      }
    }, 15000);

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
    if (!initialData.heroItems || initialData.heroItems.length === 0) return [];
    if (typeFilter === 'shows') {
      const shows = initialData.heroItems.filter(
        (i: any) => i.source === 'anilist' || i.media_type === 'tv' || i.first_air_date || i.number_of_seasons
      );
      return shows.length > 0 ? shows : initialData.heroItems;
    }
    if (typeFilter === 'movies') {
      const movies = initialData.heroItems.filter(
        (i: any) => i.media_type === 'movie' || i.release_date
      );
      return movies.length > 0 ? movies : initialData.heroItems;
    }
    if (typeFilter === 'anime') {
      const animes = initialData.heroItems.filter(
        (i: any) => i.source === 'anilist' || i.anime_format || (i.origin_country && i.origin_country.includes('JP'))
      );
      return animes.length > 0 ? animes : initialData.heroItems;
    }
    if (typeFilter === 'sports') {
      const sports = (railCache['sports'] || []).filter((i: any) => i.backdrop_path);
      return sports.length > 0 ? sports : initialData.heroItems;
    }
    if (typeFilter === 'sparks') {
      const sparks = (initialData.top10 || initialData.trending || []).filter((i: any) => i.backdrop_path);
      return sparks.length > 0 ? sparks : initialData.heroItems;
    }
    return initialData.heroItems;
  }, [initialData.heroItems, initialData.top10, initialData.trending, typeFilter]);

  // Gentle background preloader: after initial fold loads, sequentially warm remaining rails
  useEffect(() => {
    if (!homeReady || loadError) return;

    const remainingLoaders = [
      () => Promise.all([getTmdbGenre(28), getAnilistGenre('Action')]).then(([t, a]) => { railCache['action'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(28), getAnilistTag('Martial Arts')]).then(([t, a]) => { railCache['martialArts'] = mix(t.results?.slice(8), a.results); }),
      () => Promise.all([getTmdbGenre(12), getAnilistGenre('Adventure')]).then(([t, a]) => { railCache['adventure'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(28), getAnilistGenre('Sports')]).then(([t, a]) => { railCache['sports'] = mix(t.results?.slice(8), a.results); }),
      () => Promise.all([getTmdbGenre(878), getAnilistGenre('Mecha')]).then(([t, a]) => { railCache['mecha'] = mix(t.results?.slice(8), a.results); }),
      () => Promise.all([getTmdbGenre(14), getAnilistGenre('Supernatural')]).then(([t, a]) => { railCache['supernatural'] = mix(t.results?.slice(6), a.results); }),
      () => Promise.all([getTmdbGenre(12), getAnilistTag('Isekai')]).then(([t, a]) => { railCache['isekai'] = mix(t.results?.slice(6), a.results); }),
      () => Promise.all([getTmdbGenre(878), getAnilistGenre('Sci-Fi')]).then(([t, a]) => { railCache['scifi'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(878), getAnilistTag('Cyberpunk')]).then(([t, a]) => { railCache['cyberpunk'] = mix(t.results?.slice(6), a.results); }),
      () => Promise.all([getTmdbGenre(14), getAnilistGenre('Fantasy')]).then(([t, a]) => { railCache['fantasy'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(53), getAnilistTag('Survival')]).then(([t, a]) => { railCache['survival'] = mix(t.results?.slice(6), a.results); }),
      () => Promise.all([getTmdbGenre(27), getAnilistGenre('Horror')]).then(([t, a]) => { railCache['horror'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(53), getAnilistGenre('Psychological')]).then(([t, a]) => { railCache['thriller'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(9648), getAnilistGenre('Mystery')]).then(([t, a]) => { railCache['mystery'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(10752), getAnilistTag('Military')]).then(([t, a]) => { railCache['military'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(80), getAnilistGenre('Mystery')]).then(([t, a]) => { railCache['crime'] = mix(t.results, a.results?.slice(6)); }),
      () => Promise.all([getTmdbGenre(35), getAnilistGenre('Comedy')]).then(([t, a]) => { railCache['comedy'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(35), getAnilistTag('School')]).then(([t, a]) => { railCache['teen'] = mix(t.results?.slice(6), a.results); }),
      () => Promise.all([getTmdbTVGenre(35), getAnilistGenre('Comedy')]).then(([t, a]) => { railCache['sitcom'] = mix(t.results, a.results?.slice(6)); }),
      () => Promise.all([getTmdbGenre(10751), getAnilistGenre('Slice of Life')]).then(([t, a]) => { railCache['sliceOfLife'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(10751), getAnilistGenre('Adventure')]).then(([t, a]) => { railCache['family'] = mix(t.results, a.results?.slice(6)); }),
      () => Promise.all([getTmdbGenre(10749), getAnilistGenre('Romance')]).then(([t, a]) => { railCache['romance'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(18), getAnilistGenre('Drama')]).then(([t, a]) => { railCache['drama'] = mix(t.results, a.results); }),
      () => Promise.all([getTmdbGenre(99), getAnilistGenre('Drama')]).then(([t, a]) => { railCache['documentary'] = mix(t.results, a.results?.slice(6)); }),
      () => Promise.all([getTmdbGenre(10402), getAnilistGenre('Music')]).then(([t, a]) => { railCache['music'] = mix(t.results, a.results); })
    ];

    let timerId: any = null;
    let step = 0;

    const runNext = () => {
      if (step >= remainingLoaders.length) return;
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
    <div className="min-h-screen bg-black pb-20 font-sans overflow-x-hidden w-full max-w-[100vw]">
      {/* 1. Full-screen LogoReveal Overlay on /home */}
      {showOverlay && (
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
            <Hero items={heroItems} />
          )}

          {/* Content Feed with Continuous, Spaced Categories */}
          <div className="relative z-20 flex flex-col gap-4 pt-8 md:pt-10">
            {/* Ranked Spotlight: Trending Now (Portrait posters -> uses portrait skeleton loader) */}
            <LazyRail
              title="Trending Now"
              railKey="top10"
              isTop10={true}
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
          </div>
        </>
      )}
    </div>
  );
}
