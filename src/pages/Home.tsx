import React, { useEffect, useState, useRef } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import PlatformRow from '../components/PlatformRow';
import { fetchTrendingAnime, fetchNewlyAddedAnime, fetchAnimeByGenre } from '../api/anilist';
import { fetchTrending, fetchTop10, fetchAllTimeFavorites, fetchDetails, fetchByGenre, fetchTVByGenre } from '../api/tmdb';

let cachedHomeData: any = null;

export default function Home() {
  const [isLoading, setIsLoading] = useState(!cachedHomeData);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [data, setData] = useState<any>(cachedHomeData || {
    heroItems: [],
    trending: [],
    top10: [],
    action: [],
    comedy: [],
    romance: [],
    scifi: [],
    horror: [],
    sitcom: [],
    family: [],
    crime: [],
    drama: []
  });

  useEffect(() => {
    if (cachedHomeData) {
      return;
    }

    const loadData = async () => {
      let delayMs = 0;
      const safeFetch = async (promiseFn: () => Promise<any>) => {
        const currentDelay = delayMs;
        delayMs += 0; // Removed stagger to fix slow load // stagger requests by 300ms to avoid rate limits and connection drops
        try {
          if (currentDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, currentDelay));
          }
          return await promiseFn();
        } catch (e) {
          console.error("Safe fetch failed:", e);
          return { results: [] };
        }
      };

      try {
        const [
          trendingData, top10Data,
          actionData, comedyData, romanceData, scifiData, horrorData,
          sitcomData, familyData, crimeData, dramaData, trendingAnimeData, newlyAddedAnimeData, romanceAnimeData, actionAnimeData, comedyAnimeData, dramaAnimeData] = await Promise.all([
safeFetch(() => fetchTrending()),
          safeFetch(() => fetchTop10()),
          safeFetch(() => fetchByGenre(28)), // Action
          safeFetch(() => fetchByGenre(35)), // Comedy
          safeFetch(() => fetchByGenre(10749)), // Romance
          safeFetch(() => fetchByGenre(878)), // Sci-Fi
          safeFetch(() => fetchByGenre(27)), // Horror
          safeFetch(() => fetchTVByGenre(35)), // Sitcoms
          safeFetch(() => fetchByGenre(10751)), // Family
          safeFetch(() => fetchByGenre(80)), // Crime
          safeFetch(() => fetchByGenre(18)), // Drama
          safeFetch(() => fetchTrendingAnime(15, true)),
          safeFetch(() => fetchNewlyAddedAnime(15, true)),
          safeFetch(() => fetchAnimeByGenre('Romance', 15, true)),
          safeFetch(() => fetchAnimeByGenre('Action', 15, true)),
          safeFetch(() => fetchAnimeByGenre('Comedy', 15, true)),
          safeFetch(() => fetchAnimeByGenre('Drama', 15, true))
]);
        
        
        // Assemble Hero
        const animePool = [...(trendingAnimeData.results || []), ...(newlyAddedAnimeData.results || [])]
          .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i) // unique
          .filter(a => !(a.title && a.title.toLowerCase().includes('polar opposite')));
        
        // Ensure we don't pick undefined items
        const selectedAnime = animePool.slice(0, 3);
        
        // Filter out anime from trendingData (should already be done by tmdb filter)
        // and separate by type
        const tvPool = (trendingData.results || []).filter((i: any) => i.media_type === 'tv' && i.id);
        const moviePool = (trendingData.results || []).filter((i: any) => i.media_type === 'movie' && i.id);
        
        const selectedTv = tvPool.slice(0, 3);
        const selectedMovie = moviePool.slice(0, 4);
        
        const combinedHeroItems = [...selectedAnime, ...selectedTv, ...selectedMovie];
        
        // Shuffle
        for (let i = combinedHeroItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combinedHeroItems[i], combinedHeroItems[j]] = [combinedHeroItems[j], combinedHeroItems[i]];
        }
        
        const detailedHeroItems = await Promise.all(
          combinedHeroItems.map(async (item: any) => {
            if (item.source === 'anilist') return item; // No extra fetch needed for AniList right now unless we want more details
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
          const res = [];
          const max = Math.max(tmdb.length, anilist.length);
          for (let i = 0; i < max; i++) {
            if (tmdb[i]) res.push(tmdb[i]);
            if (anilist[i]) res.push(anilist[i]);
          }
          return res;
        };
        
        const newData = {
          heroItems: detailedHeroItems,
          trending: trendingData.results || [],
          top10: mix(filteredTop10, trendingAnimeData.results || []).slice(0, 10),
          action: mix(actionData.results || [], actionAnimeData.results || []),
          comedy: mix(comedyData.results || [], comedyAnimeData.results || []),
          romance: mix(romanceData.results || [], romanceAnimeData.results || []),
          scifi: scifiData.results || [],
          horror: horrorData.results || [],
          sitcom: sitcomData.results || [],
          family: familyData.results || [],
          crime: crimeData.results || [],
          drama: mix(dramaData.results || [], dramaAnimeData.results || [])
        };

        
        cachedHomeData = newData;
        setData(newData);
        setIsFadingOut(true);
        setTimeout(() => setIsLoading(false), 800);
      } catch (err) {
        console.error("Failed to load TMDB data", err);
        setIsFadingOut(true);
        setTimeout(() => setIsLoading(false), 800);
      }
    };
    
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-black pb-20 font-sans overflow-x-hidden w-[100vw]">
      {isLoading && (
        <div 
          className={`fixed inset-0 z-[200] bg-black flex items-center justify-center transition-opacity duration-700 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-[#d4d4d4] text-5xl md:text-7xl font-black lowercase tracking-tight drop-shadow-md animate-pulse">
              miyoro
            </h1>
            <div className="w-32 md:w-40 h-1 bg-white/10 rounded-full overflow-hidden mt-1 relative">
              <div className="absolute top-0 left-0 h-full w-1/3 bg-[#d4d4d4] rounded-full" style={{ animation: 'loading-bar 1.5s infinite ease-in-out' }}></div>
            </div>
          </div>
        </div>
      )}
      <Hero items={data.heroItems} />
      <div className="relative z-20 flex flex-col gap-10 pt-4">
        
        <Row 
          title="Trending Now" 
          items={data.top10} 
          isTop10={true} 
        />
        
        <Row 
          title="Suggested For You" 
          items={data.trending.slice(4)} 
        />

        <PlatformRow />
        
        <Row title="Action & Adventure" items={data.action} />
        <Row title="Comedies" items={data.comedy} />
        <Row title="Romance" items={data.romance} />
        <Row title="Sci-Fi & Fantasy" items={data.scifi} />
        <Row title="Horror" items={data.horror} />
        <Row title="Sitcoms" items={data.sitcom} />
        <Row title="Family Movies" items={data.family} />
        <Row title="Crime" items={data.crime} />
        <Row title="Drama" items={data.drama} />
      </div>
    </div>
  );
}
