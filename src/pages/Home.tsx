import React, { useEffect, useState, useRef } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import PlatformRow from '../components/PlatformRow';
import { fetchTrendingAnime, fetchNewlyAddedAnime, fetchAnimeByGenre } from '../api/anilist';
import { fetchTrending, fetchTop10, fetchAllTimeFavorites, fetchDetails, fetchByGenre, fetchTVByGenre } from '../api/tmdb';

let cachedHomeData: any = null;

export default function Home() {
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
      const safeFetch = async (promise: Promise<any>) => {
        try {
          return await promise;
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
safeFetch(fetchTrending()),
          safeFetch(fetchTop10()),
          safeFetch(fetchByGenre(28)), // Action
          safeFetch(fetchByGenre(35)), // Comedy
          safeFetch(fetchByGenre(10749)), // Romance
          safeFetch(fetchByGenre(878)), // Sci-Fi
          safeFetch(fetchByGenre(27)), // Horror
          safeFetch(fetchTVByGenre(35)), // Sitcoms
          safeFetch(fetchByGenre(10751)), // Family
          safeFetch(fetchByGenre(80)), // Crime
          safeFetch(fetchByGenre(18)), // Drama
          safeFetch(fetchTrendingAnime(10)),
          safeFetch(fetchNewlyAddedAnime(10)),
          safeFetch(fetchAnimeByGenre('Romance', 10)),
          safeFetch(fetchAnimeByGenre('Action', 10)),
          safeFetch(fetchAnimeByGenre('Comedy', 10)),
          safeFetch(fetchAnimeByGenre('Drama', 10))
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
        }).slice(0, 10);
        
        
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
          top10: filteredTop10,
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
      } catch (err) {
        console.error("Failed to load TMDB data", err);
      }
    };
    
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b0b] pb-20 font-sans overflow-x-hidden w-[100vw]">
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
