import React, { useEffect, useState, useRef, useMemo } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import PlatformRow from '../components/PlatformRow';
import LogoReveal from '../components/MiyoroLogoReveal';
import { SkeletonHero, SkeletonRow } from '../components/MiyoroSkeletons';
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

let cachedHomeData: any = null;
let homeLoadPromise: Promise<any> | null = null;

export const preloadHomeData = async (): Promise<any> => {
  if (cachedHomeData) return cachedHomeData;
  if (homeLoadPromise) return homeLoadPromise;

  homeLoadPromise = (async () => {
    const safeFetch = async (promiseFn: () => Promise<any>) => {
      try {
        return await promiseFn();
      } catch (e) {
        console.error("Safe fetch failed:", e);
        return { results: [] };
      }
    };

    try {
      const [
        trendingData,
        top10Data,
        topRatedMoviesData,
        // Existing TMDB
        actionData,
        comedyData,
        romanceData,
        scifiData,
        horrorData,
        sitcomData,
        familyData,
        crimeData,
        dramaData,
        // Extra TMDB Genres
        mysteryData,
        thrillerData,
        fantasyData,
        adventureData,
        musicData,
        documentaryData,
        warData,
        // AniList Anime Genres & Tags
        trendingAnimeData,
        newlyAddedAnimeData,
        topRatedAnimeData,
        actionAnimeData,
        comedyAnimeData,
        romanceAnimeData,
        scifiAnimeData,
        horrorAnimeData,
        mysteryAnimeData,
        psychologicalAnimeData,
        fantasyAnimeData,
        adventureAnimeData,
        sportsAnimeData,
        sliceOfLifeAnimeData,
        mechaAnimeData,
        dramaAnimeData,
        musicAnimeData,
        supernaturalAnimeData,
        cyberpunkAnimeData,
        martialArtsAnimeData,
        survivalAnimeData,
        isekaiAnimeData,
        militaryAnimeData,
        schoolAnimeData
      ] = await Promise.all([
        safeFetch(() => fetchTrending()),
        safeFetch(() => fetchTop10()),
        safeFetch(() => fetchAllTimeFavorites()),
        safeFetch(() => fetchByGenre(28)), // Action
        safeFetch(() => fetchByGenre(35)), // Comedy
        safeFetch(() => fetchByGenre(10749)), // Romance
        safeFetch(() => fetchByGenre(878)), // Sci-Fi
        safeFetch(() => fetchByGenre(27)), // Horror
        safeFetch(() => fetchTVByGenre(35)), // Sitcoms
        safeFetch(() => fetchByGenre(10751)), // Family
        safeFetch(() => fetchByGenre(80)), // Crime
        safeFetch(() => fetchByGenre(18)), // Drama
        safeFetch(() => fetchByGenre(9648)), // Mystery
        safeFetch(() => fetchByGenre(53)), // Thriller
        safeFetch(() => fetchByGenre(14)), // Fantasy
        safeFetch(() => fetchByGenre(12)), // Adventure
        safeFetch(() => fetchByGenre(10402)), // Music
        safeFetch(() => fetchByGenre(99)), // Documentary
        safeFetch(() => fetchByGenre(10752)), // War
        // AniList
        safeFetch(() => fetchTrendingAnime(15)),
        safeFetch(() => fetchNewlyAddedAnime(15)),
        safeFetch(() => fetchTopRatedAnime(15)),
        safeFetch(() => fetchAnimeByGenre('Action', 15)),
        safeFetch(() => fetchAnimeByGenre('Comedy', 15)),
        safeFetch(() => fetchAnimeByGenre('Romance', 15)),
        safeFetch(() => fetchAnimeByGenre('Sci-Fi', 15)),
        safeFetch(() => fetchAnimeByGenre('Horror', 15)),
        safeFetch(() => fetchAnimeByGenre('Mystery', 15)),
        safeFetch(() => fetchAnimeByGenre('Psychological', 15)),
        safeFetch(() => fetchAnimeByGenre('Fantasy', 15)),
        safeFetch(() => fetchAnimeByGenre('Adventure', 15)),
        safeFetch(() => fetchAnimeByGenre('Sports', 15)),
        safeFetch(() => fetchAnimeByGenre('Slice of Life', 15)),
        safeFetch(() => fetchAnimeByGenre('Mecha', 15)),
        safeFetch(() => fetchAnimeByGenre('Drama', 15)),
        safeFetch(() => fetchAnimeByGenre('Music', 15)),
        safeFetch(() => fetchAnimeByGenre('Supernatural', 15)),
        safeFetch(() => fetchAnimeByTag('Cyberpunk', 15)),
        safeFetch(() => fetchAnimeByTag('Martial Arts', 15)),
        safeFetch(() => fetchAnimeByTag('Survival', 15)),
        safeFetch(() => fetchAnimeByTag('Isekai', 15)),
        safeFetch(() => fetchAnimeByTag('Military', 15)),
        safeFetch(() => fetchAnimeByTag('School', 15))
      ]);

      // Assemble Hero with deduplicated anime
      const animePool = dedupeItems([
        ...(trendingAnimeData.results || []),
        ...(newlyAddedAnimeData.results || [])
      ]).filter(a => !(a.title && a.title.toLowerCase().includes('polar opposite')));

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

      const newData = {
        heroItems: detailedHeroItems,
        trending: dedupeItems(trendingData.results || []),
        top10: mix(filteredTop10, trendingAnimeData.results || []).slice(0, 10),
        topRated: mix(topRatedMoviesData.results || [], topRatedAnimeData.results || []),
        action: mix(actionData.results || [], actionAnimeData.results || []),
        martialArts: mix(actionData.results?.slice(8) || [], martialArtsAnimeData.results || []),
        adventure: mix(adventureData.results || [], adventureAnimeData.results || []),
        supernatural: mix(fantasyData.results?.slice(6) || [], supernaturalAnimeData.results || []),
        isekai: mix(adventureData.results?.slice(6) || [], isekaiAnimeData.results || []),
        scifi: mix(scifiData.results || [], scifiAnimeData.results || []),
        cyberpunk: mix(scifiData.results?.slice(6) || [], cyberpunkAnimeData.results || []),
        survival: mix(thrillerData.results?.slice(6) || [], survivalAnimeData.results || []),
        military: mix(warData.results || [], militaryAnimeData.results || []),
        comedy: mix(comedyData.results || [], comedyAnimeData.results || []),
        teen: mix(comedyData.results?.slice(6) || [], schoolAnimeData.results || []),
        sitcom: mix(sitcomData.results || [], comedyAnimeData.results?.slice(6) || []),
        romance: mix(romanceData.results || [], romanceAnimeData.results || []),
        horror: mix(horrorData.results || [], horrorAnimeData.results || []),
        thriller: mix(thrillerData.results || [], psychologicalAnimeData.results || []),
        mystery: mix(mysteryData.results || [], mysteryAnimeData.results || []),
        fantasy: mix(fantasyData.results || [], fantasyAnimeData.results || []),
        sports: mix(actionData.results?.slice(8) || [], sportsAnimeData.results || []),
        sliceOfLife: mix(familyData.results || [], sliceOfLifeAnimeData.results || []),
        mecha: mix(scifiData.results?.slice(8) || [], mechaAnimeData.results || []),
        family: mix(familyData.results || [], adventureAnimeData.results?.slice(6) || []),
        crime: mix(crimeData.results || [], mysteryAnimeData.results?.slice(6) || []),
        drama: mix(dramaData.results || [], dramaAnimeData.results || []),
        documentary: mix(documentaryData.results || [], dramaAnimeData.results?.slice(6) || []),
        music: mix(musicData.results || [], musicAnimeData.results || [])
      };

      // 1. Resolve clear logos for top visible items first
      const priorityItems = [
        ...newData.heroItems.slice(0, 4)
      ];
      await Promise.race([
        preloadLogosForItems(priorityItems),
        new Promise(r => setTimeout(r, 400))
      ]);

      // 2. Preload critical image bytes into browser GPU cache
      const criticalImageUrls: (string | null | undefined)[] = [];
      const firstHero = newData.heroItems[0];
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

      for (const h of newData.heroItems) {
        if (h?.poster_path) {
          criticalImageUrls.push(
            h.poster_path.startsWith('http') ? h.poster_path : `${IMAGE_BASE_URL_W500}${h.poster_path}`
          );
        }
      }

      for (const card of (newData.top10.slice(0, 6) as any[])) {
        if (card?.backdrop_path) {
          criticalImageUrls.push(
            card.backdrop_path.startsWith('http') ? card.backdrop_path : `${IMAGE_BASE_URL_W500}${card.backdrop_path}`
          );
        }
        criticalImageUrls.push(getCachedLogo(card));
      }

      for (const card of (newData.trending.slice(4, 9) as any[])) {
        if (card?.backdrop_path) {
          criticalImageUrls.push(
            card.backdrop_path.startsWith('http') ? card.backdrop_path : `${IMAGE_BASE_URL_W500}${card.backdrop_path}`
          );
        }
        criticalImageUrls.push(getCachedLogo(card));
      }

      await preloadImageUrls(criticalImageUrls, 800);

      cachedHomeData = newData;
      return newData;
    } catch (err) {
      console.error("Failed to load Home data", err);
      return null;
    } finally {
      homeLoadPromise = null;
    }
  })();

  return homeLoadPromise;
};

let hasShownHomeReveal = false;

interface HomeProps {
  typeFilter?: 'shows' | 'movies' | 'anime' | 'sports' | 'sparks' | 'categories';
}

export default function Home({ typeFilter }: HomeProps = {}) {
  // Only trigger LogoReveal on /home (including root landing when visiting /home)
  const isHomeVisit = !typeFilter || window.location.pathname === '/home';
  const shouldReveal = isHomeVisit && !hasShownHomeReveal;

  const [showOverlay, setShowOverlay] = useState(shouldReveal);
  const [overlayFading, setOverlayFading] = useState(false);
  const [revealRound, setRevealRound] = useState(0);

  const [homeReady, setHomeReady] = useState(Boolean(cachedHomeData));
  const homeReadyRef = useRef(Boolean(cachedHomeData));
  const [loadError, setLoadError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const [data, setData] = useState<any>(cachedHomeData || {
    heroItems: [],
    trending: [],
    top10: [],
    topRated: [],
    action: [],
    martialArts: [],
    adventure: [],
    supernatural: [],
    isekai: [],
    scifi: [],
    cyberpunk: [],
    survival: [],
    military: [],
    comedy: [],
    teen: [],
    sitcom: [],
    romance: [],
    horror: [],
    thriller: [],
    mystery: [],
    fantasy: [],
    sports: [],
    sliceOfLife: [],
    mecha: [],
    family: [],
    crime: [],
    drama: [],
    documentary: [],
    music: []
  });

  // Track onDone event from LogoReveal
  const handleRevealDone = () => {
    if (homeReadyRef.current) {
      hasShownHomeReveal = true;
      setOverlayFading(true);
      setTimeout(() => {
        setShowOverlay(false);
      }, 300);
    } else {
      // Home isn't ready when reveal finishes: restart reveal by changing round key
      setRevealRound((r) => r + 1);
    }
  };

  // 15-second safety timeout: never loop forever
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

  // Keep home mounted and fetching underneath the overlay
  useEffect(() => {
    let isMounted = true;

    if (cachedHomeData) {
      setData(cachedHomeData);
      homeReadyRef.current = true;
      setHomeReady(true);
      return;
    }

    preloadHomeData()
      .then((loaded) => {
        if (!isMounted) return;
        if (loaded) {
          setData(loaded);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load Home data:', err);
        if (isMounted) setLoadError(true);
      })
      .finally(() => {
        if (isMounted) {
          homeReadyRef.current = true;
          setHomeReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    setLoadError(false);
    preloadHomeData()
      .then((loaded) => {
        if (loaded) {
          setData(loaded);
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
    if (!data.heroItems || data.heroItems.length === 0) return [];
    if (typeFilter === 'shows') {
      const shows = data.heroItems.filter((i: any) => i.source === 'anilist' || i.media_type === 'tv' || i.first_air_date || i.number_of_seasons);
      return shows.length > 0 ? shows : data.heroItems;
    }
    if (typeFilter === 'movies') {
      const movies = data.heroItems.filter((i: any) => i.media_type === 'movie' || i.release_date);
      return movies.length > 0 ? movies : data.heroItems;
    }
    if (typeFilter === 'anime') {
      const animes = data.heroItems.filter((i: any) => i.source === 'anilist' || i.anime_format || (i.origin_country && i.origin_country.includes('JP')));
      return animes.length > 0 ? animes : data.heroItems;
    }
    if (typeFilter === 'sports') {
      const sports = (data.sports || []).filter((i: any) => i.backdrop_path);
      return sports.length > 0 ? sports : data.heroItems;
    }
    if (typeFilter === 'sparks') {
      const sparks = (data.top10 || data.trending || []).filter((i: any) => i.backdrop_path);
      return sparks.length > 0 ? sparks : data.heroItems;
    }
    return data.heroItems;
  }, [data.heroItems, data.sports, data.top10, data.trending, typeFilter]);

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

      {/* Skeletons when data is loading */}
      {!homeReady && (
        <div className="px-4 md:px-12 pt-6 space-y-8">
          <SkeletonHero />
          <div className="space-y-6 pt-4">
            <SkeletonRow count={8} />
            <SkeletonRow count={8} />
            <SkeletonRow count={8} />
          </div>
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
      {homeReady && !loadError && (
        <>
          {/* Hero Billboard */}
          <Hero items={heroItems} />

          {/* Content Feed with Continuous, Spaced Categories */}
          <div className="relative z-20 flex flex-col gap-4 pt-8 md:pt-10">
            {/* Ranked Spotlight */}
            <Row 
              title="Trending Now" 
              items={data.top10} 
              isTop10={true} 
            />
            
            {/* Curated Recommendations */}
            <Row 
              title="Suggested For You" 
              items={data.trending.slice(4)} 
            />

            {/* All-Time Critically Acclaimed */}
            <Row 
              title="Masterpieces & Hall of Fame" 
              items={data.topRated} 
            />

            {/* Streaming Providers */}
            <PlatformRow />
            
            {/* High Energy & Combat */}
            <Row title="Action & Adventure" items={data.action} />
            <Row title="Martial Arts & Hand-to-Hand Combat" items={data.martialArts} />
            <Row title="Grand Adventures & Quests" items={data.adventure} />
            <Row title="High-Octane Sports & Rivalries" items={data.sports} />
            <Row title="Mecha, Tech & Future Warfare" items={data.mecha} />

            {/* Supernatural, Fantasy & Sci-Fi */}
            <Row title="Supernatural & Dark Fantasy" items={data.supernatural} />
            <Row title="Isekai & Alternate Realities" items={data.isekai} />
            <Row title="Sci-Fi & Cyber Realms" items={data.scifi} />
            <Row title="Cyberpunk & Dystopian Visions" items={data.cyberpunk} />
            <Row title="Epic Fantasy & Mythic Worlds" items={data.fantasy} />

            {/* Survival, Thrillers & Suspense */}
            <Row title="Survival Games & Apocalyptic Worlds" items={data.survival} />
            <Row title="Horror & Dark Nightmares" items={data.horror} />
            <Row title="Mind-Bending & Psychological Thrillers" items={data.thriller} />
            <Row title="Mystery & Whodunits" items={data.mystery} />
            <Row title="Espionage, War & Tactical Battles" items={data.military} />
            <Row title="Crime, Heists & Underworld" items={data.crime} />

            {/* Comedy, Campus & Comfort */}
            <Row title="Comedies & Laughs" items={data.comedy} />
            <Row title="Campus Life & High School Dramas" items={data.teen} />
            <Row title="Sitcoms & Bingeable Comfort" items={data.sitcom} />
            <Row title="Warm & Cozy: Slice of Life" items={data.sliceOfLife} />
            <Row title="Family & Heartfelt Animation" items={data.family} />

            {/* Romance, Drama, Docs & Music */}
            <Row title="Romance & Heartstrings" items={data.romance} />
            <Row title="Gripping Drama & Emotional Tales" items={data.drama} />
            <Row title="Real Stories & Documentaries" items={data.documentary} />
            <Row title="Musical & Rhythmic Spotlight" items={data.music} />
          </div>
        </>
      )}
    </div>
  );
}
