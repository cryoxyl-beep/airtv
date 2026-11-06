import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import { searchMovies, searchTV } from '../api/tmdb';
import { searchAnime } from '../api/anilist';
import { RowCard } from '../components/Row';

type FilterType = '' | 'all' | 'movies' | 'series' | 'anime';

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

  const [inputVal, setInputVal] = useState(query);

  const handleFilterClick = (newFilter: FilterType) => {
    navigate(`/search?q=${encodeURIComponent(inputVal.trim())}&filter=${newFilter}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      navigate(`/search?q=${encodeURIComponent(inputVal.trim())}&filter=${filter}`);
    }
  };

  return (
    <div className="min-h-screen bg-black pt-8 sm:pt-12 px-4 sm:px-8 lg:px-12 pb-24 font-sans text-white">
      <div className="max-w-[1450px] mx-auto space-y-8">
        
        {/* Top Header & Search Bar */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/home');
                }
              }}
              className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group shrink-0 cursor-pointer"
              aria-label="Go Back"
            >
              <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Search</h1>
          </div>

          {/* Search Input Form */}
          <form 
            onSubmit={handleSearchSubmit}
            className="relative w-full max-w-2xl bg-[#161616] border border-white/15 focus-within:border-white/40 shadow-xl rounded-2xl overflow-hidden transition-all duration-200"
          >
            <div className="relative flex items-center h-13 sm:h-14 px-4">
              <Search className="w-5 h-5 text-white/50 shrink-0 mr-3" />
              <input
                type="text"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  if (!e.target.value) {
                    navigate(`/search?q=&filter=${filter}`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(e);
                  }
                }}
                placeholder="Search movies, TV shows, anime, genres..."
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-white/40 outline-none"
                autoFocus
              />
              {inputVal && (
                <button
                  type="button"
                  onClick={() => {
                    setInputVal('');
                    navigate(`/search?q=&filter=${filter}`);
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="text-sm font-bold">✕</span>
                </button>
              )}
            </div>
          </form>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'movies', label: 'Movies' },
              { id: 'series', label: 'TV Shows' },
              { id: 'anime', label: 'Anime' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterClick(tab.id as FilterType)}
                className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  (filter === tab.id || (!filter && tab.id === 'all'))
                    ? 'bg-white text-black shadow-md'
                    : 'bg-[#181818] border border-white/10 text-white/70 hover:text-white hover:bg-[#222222]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Status or Query Label */}
        {query && (
          <div className="pt-2 text-sm text-white/60">
            Showing results for <span className="text-white font-medium">"{query}"</span>
          </div>
        )}

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/40 text-center space-y-3">
            <Search className="w-12 h-12 opacity-30" />
            <p className="text-base sm:text-lg font-medium">Type a title, actor, or genre above</p>
            <p className="text-xs sm:text-sm text-white/30 max-w-sm">
              Search across thousands of movies, series episodes, and anime titles in our catalog.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/40 text-center space-y-2">
            <p className="text-lg font-medium">No results found for "{query}"</p>
            <p className="text-xs sm:text-sm text-white/30">
              Try checking your spelling or searching for a different keyword.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {results.map((item, index) => (
              <div key={item.id + '-' + index} className="w-full">
                <RowCard item={item} index={index} isGridCard={true} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
