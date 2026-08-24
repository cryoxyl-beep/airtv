import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import { searchMovies, searchTV } from '../api/tmdb';
import { searchAnime } from '../api/anilist';
import { RowCard } from '../components/Row';

type FilterType = 'all' | 'movies' | 'series' | 'anime';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const filter = (searchParams.get('filter') as FilterType) || 'all';
  const navigate = useNavigate();
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
            searchAnime(query)
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
        console.error("Search failed", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [query, filter]);

  return (
    <div className="min-h-screen bg-[#0b0b0b] pt-32 px-8 md:px-12 pb-20">
      <div className="max-w-[1450px] mx-auto">
        
        <div className="mb-12 flex items-center gap-6">
          <button 
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
            aria-label="Go Back"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          
          {query && (
            <h1 className="text-2xl font-semibold text-white/90">
              Search Results for <span className="text-white">"{query}"</span>
            </h1>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mx-auto w-full max-w-[1450px]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)] max-w-[450px] aspect-video bg-white/5 rounded-md animate-pulse flex-shrink-0" />
            ))}
          </div>
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <Search className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl font-medium">Type something to search</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <p className="text-xl font-medium">No results found for "{query}"</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mx-auto w-full max-w-[1450px]">
            {results.map((item, index) => (
               <div key={item.id + '-' + index} className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)] max-w-[450px] flex-shrink-0">
                  <RowCard item={item} index={index} isGridCard={true} />
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
