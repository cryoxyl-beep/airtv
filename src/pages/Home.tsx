import React, { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import { fetchTrending, fetchTop10, fetchAnime, fetchAllTimeFavorites, fetchDetails, fetchByGenre, fetchTVByGenre } from '../api/tmdb';

export default function Home() {
  const [heroItems, setHeroItems] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [top10, setTop10] = useState<any[]>([]);
  
  const [action, setAction] = useState<any[]>([]);
  const [comedy, setComedy] = useState<any[]>([]);
  const [romance, setRomance] = useState<any[]>([]);
  const [scifi, setScifi] = useState<any[]>([]);
  const [horror, setHorror] = useState<any[]>([]);
  const [sitcom, setSitcom] = useState<any[]>([]);
  const [family, setFamily] = useState<any[]>([]);
  const [crime, setCrime] = useState<any[]>([]);
  const [drama, setDrama] = useState<any[]>([]);
  
  useEffect(() => {
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
        
        setHeroItems(detailedHeroItems);
        setTrending(trendingData.results || []);
        const filteredTop10 = (top10Data.results || []).filter((item: any) => {
          const title = item.title || item.name || '';
          return title !== 'Tagesschau' && title !== 'Paradise Hotel';
        });
        
        setTop10(filteredTop10.slice(0, 10));
        
        setAction(actionData.results || []);
        setComedy(comedyData.results || []);
        setRomance(romanceData.results || []);
        setScifi(scifiData.results || []);
        setHorror(horrorData.results || []);
        setSitcom(sitcomData.results || []);
        setFamily(familyData.results || []);
        setCrime(crimeData.results || []);
        setDrama(dramaData.results || []);
      } catch (err) {
        console.error("Failed to load TMDB data", err);
      }
    };
    
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b0b] pb-20 font-sans overflow-x-hidden w-[100vw]">
      <Hero items={heroItems} />

      <div className="relative z-20 flex flex-col gap-10 pt-4">
        
        <Row 
          title="Trending Now" 
          items={top10} 
          isTop10={true} 
        />
        
        <Row 
          title="Suggested For You" 
          items={trending.slice(4)} 
        />
        
        <Row title="Action & Adventure" items={action} />
        <Row title="Comedies" items={comedy} />
        <Row title="Romance" items={romance} />
        <Row title="Sci-Fi & Fantasy" items={scifi} />
        <Row title="Horror" items={horror} />
        <Row title="Sitcoms" items={sitcom} />
        <Row title="Family Movies" items={family} />
        <Row title="Crime" items={crime} />
        <Row title="Drama" items={drama} />

      </div>
    </div>
  );
}
