import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchByProvider, fetchTVByProvider, IMAGE_BASE_URL_W500 } from '../api/tmdb';
import { RowCard } from '../components/Row';
import { ArrowLeft } from 'lucide-react';

const platforms = {
  'netflix': { id: 8, name: 'Netflix', logo: '/netflix.png' },
  'prime-video': { id: 9, name: 'Prime Video', logo: '/prime.png' },
  'disney-plus': { id: 337, name: 'Disney+', logo: '/disney.png' },
  'apple-tv-plus': { id: 350, name: 'Apple TV+', logo: '/apple.png' },
  'hulu': { id: 15, name: 'Hulu', logo: '/hulu.png' },
  'hbo-max': { id: 1899, name: 'HBO Max', logo: '/hbo.png' },
  'paramount': { id: 531, name: 'Paramount+', logo: '/paramount.png' },
};

export default function BrowsePage() {
  const { platform } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState<'movie' | 'tv'>(() => {
    return (sessionStorage.getItem(`browse-tab-${location.key}`) as 'movie' | 'tv') || 'movie';
  });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const platformInfo = platform ? platforms[platform as keyof typeof platforms] : null;

  useEffect(() => {
    sessionStorage.setItem(`browse-tab-${location.key}`, activeTab);
  }, [activeTab, location.key]);

  useEffect(() => {
    if (!platformInfo) {
      navigate('/');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'movie') {
          const data = await fetchByProvider(platformInfo.id);
          setItems(data.results || []);
        } else {
          const data = await fetchTVByProvider(platformInfo.id);
          setItems(data.results || []);
        }
      } catch (err) {
        console.error("Failed to load provider data", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [platformInfo, activeTab]);

  if (!platformInfo) return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] font-sans pb-20 w-[100vw] overflow-x-hidden">
      {/* Header */}
      <div className="relative pt-24 pb-8 px-6 md:px-12 z-20 flex flex-col items-center">
        <div className="absolute top-0 left-0 w-full p-6 z-50 flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-3 bg-black/40 hover:bg-white/10 rounded-full backdrop-blur-md transition-all group"
            aria-label="Go Back"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform text-white" />
          </button>
        </div>

        <img
          src={platformInfo.logo}
          alt={platformInfo.name}
          className="h-16 md:h-20 object-contain drop-shadow-[0_4px_15px_rgba(0,0,0,0.8)] mb-8"
        />

        {/* Tabs */}
        <div className="flex bg-[#141414] p-1 rounded-full border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => setActiveTab('movie')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              activeTab === 'movie' 
                ? 'bg-white text-black shadow-md' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Movies
          </button>
          <button
            onClick={() => setActiveTab('tv')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              activeTab === 'tv' 
                ? 'bg-white text-black shadow-md' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            TV Shows
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 md:px-12 relative z-20 mt-8 max-w-[2000px] mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-video bg-white/5 rounded-md animate-pulse" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {items.map((item, index) => {
              if (!item.backdrop_path) return null;
              // Add a wrapper to constraint the width since RowCard is styled for Row carousel mostly
              // Wait, RowCard has fixed widths in Row component: 'w-[300px] md:w-[400px] lg:w-[450px]'
              // We might need to handle RowCard responsiveness in Grid. 
              // Let's pass a gridMode prop or override it in RowCard, or just extract the inner card.
              return (
                <div key={item.id} className="relative z-10">
                  <GridCard item={item} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-white/50 py-20 text-lg">
            No titles found.
          </div>
        )}
      </div>
    </div>
  );
}

// A version of RowCard adapted for Grid layout
function GridCard({ item }: { item: any }) {
  const navigate = useNavigate();
  return (
    <div
      className="cursor-pointer group relative transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-110"
      onClick={() => {
        const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        if (type === 'tv') {
          navigate(`/watch/tv/${item.id}`);
        } else {
          navigate(`/watch/movie/${item.id}`);
        }
      }}
    >
      <div className="relative rounded-md overflow-hidden bg-[#141414] border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] group-hover:border-white/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.15)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] aspect-video z-20 w-full">
        <img
          src={`${IMAGE_BASE_URL_W500}${item.backdrop_path}`}
          alt={item.title || item.name}
          className="w-full h-full object-cover transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] group-hover:scale-105 group-hover:brightness-110"
          loading="lazy"
          draggable={false}
        />
        <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end items-center p-4 pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
           <h3 className="text-white font-bold text-sm drop-shadow-md text-center">
             {item.title || item.name}
           </h3>
        </div>
      </div>
    </div>
  );
}
