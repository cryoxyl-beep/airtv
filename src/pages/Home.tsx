import React, { useEffect, useState, useRef } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import PlatformRow from '../components/PlatformRow';
import { fetchTrending, fetchTop10, fetchAnime, fetchAllTimeFavorites, fetchDetails, fetchByGenre, fetchTVByGenre } from '../api/tmdb';

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
          sitcomData, familyData, crimeData, dramaData
        ] = await Promise.all([
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
          safeFetch(fetchByGenre(18)) // Drama
        ]);
        
        const top10Trending = trendingData.results?.slice(0, 10) || [];
        const detailedHeroItems = await Promise.all(
          top10Trending.map(async (item: any) => {
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
        
        const newData = {
          heroItems: detailedHeroItems,
          trending: trendingData.results || [],
          top10: filteredTop10,
          action: actionData.results || [],
          comedy: comedyData.results || [],
          romance: romanceData.results || [],
          scifi: scifiData.results || [],
          horror: horrorData.results || [],
          sitcom: sitcomData.results || [],
          family: familyData.results || [],
          crime: crimeData.results || [],
          drama: dramaData.results || []
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
