const fs = require('fs');

const content = `import React, { useState, useEffect } from 'react';
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
            className="p-3 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition-all group border border-white/10"
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
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-[300px] md:w-[400px] lg:w-[450px] aspect-video bg-white/5 rounded-md animate-pulse" />
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
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8 max-w-[1450px] mx-auto">
            {results.map((item, index) => (
               <div key={item.id + '-' + index} className="flex-shrink-0">
                  <RowCard item={item} index={index} />
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/SearchPage.tsx', content, 'utf8');
