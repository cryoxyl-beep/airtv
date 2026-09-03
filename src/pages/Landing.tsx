import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { fetchTop10, IMAGE_BASE_URL_W500, fetchTrending } from '../api/tmdb';
import { fetchTrendingAnime } from '../api/anilist';
import { ChevronRight, User } from 'lucide-react';

const CinematicPosterWall = ({ posters }: { posters: any[] }) => {
  const prefersReducedMotion = useReducedMotion();
  
  // Split posters into 4 columns
  const cols = [[], [], [], []] as any[][];
  posters.forEach((p, i) => cols[i % 4].push(p));

  // Speeds for parallax effect
  const durations = [45, 60, 50, 65]; 
  const directions = [
    ['0%', '-50%'], // Up
    ['-50%', '0%'], // Down
    ['0%', '-50%'], // Up
    ['-50%', '0%'], // Down
  ];

  return (
    <div className="absolute inset-0 w-full h-[130vh] -top-[15vh] overflow-hidden bg-black flex gap-3 md:gap-4 lg:gap-6 px-2 md:px-4 lg:px-8 opacity-50 md:opacity-70 pointer-events-none transform -skew-y-6 scale-[1.15]">
      {cols.map((col, i) => {
        const duplicatedCol = [...col, ...col]; // Duplicate for seamless loop
        return (
          <div key={i} className={`flex-1 flex flex-col gap-3 md:gap-4 lg:gap-6 ${i > 1 ? 'hidden md:flex' : ''} ${i > 2 ? 'hidden lg:flex' : ''}`}>
            <motion.div 
              className="flex flex-col gap-3 md:gap-4 lg:gap-6"
              animate={prefersReducedMotion ? {} : { y: directions[i] as any }}
              transition={{
                repeat: Infinity,
                ease: "linear",
                duration: durations[i]
              }}
            >
              {duplicatedCol.map((poster, idx) => (
                <div key={idx} className="w-full relative rounded-xl md:rounded-2xl overflow-hidden aspect-[2/3] shadow-2xl transition-all duration-700">
                  {poster.poster_path ? (
                    <img 
                      src={poster.poster_path.startsWith('http') ? poster.poster_path : `${IMAGE_BASE_URL_W500}${poster.poster_path}`} 
                      alt={poster.title || 'Poster'} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5" />
                  )}
                  {/* Subtle darkening on the posters themselves */}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/0 transition-colors duration-500" />
                </div>
              ))}
            </motion.div>
          </div>
        );
      })}
      
      {/* Overlays to blend into the right panel */}
      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-transparent via-black/80 to-black w-full" />
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const [wallPosters, setWallPosters] = useState<any[]>([]);
  const [showSplash, setShowSplash] = useState(true);

  // We'll use a local state to toggle login view for now.
  // In a real app, this would be derived from an AuthContext or Firebase.
  const [isLoggedIn] = useState(false); 
  const userProfile = { name: 'Santosh' };

  useEffect(() => {
    // Quick 1-second splash for the landing page
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadLandingData = async () => {
      try {
        const [trendingRes, animeRes, moviesRes] = await Promise.all([
          fetchTop10(),
          fetchTrendingAnime(20),
          fetchTrending()
        ]);
        
        // Assemble posters for wall
        const mixed = [
          ...(trendingRes.results || []),
          ...(animeRes.results || []),
          ...(moviesRes.results || [])
        ].filter(p => p.poster_path);
        
        // Shuffle for visual variety
        for (let i = mixed.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
        }
        
        // Unique
        const uniquePosters = mixed.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
        setWallPosters(uniquePosters.slice(0, 40));

      } catch (err) {
        console.error("Error loading landing data:", err);
      }
    };
    loadLandingData();
  }, []);

  return (
    <div className="h-screen bg-black font-sans w-[100vw] overflow-hidden relative selection:bg-white/30">
      
      {/* Fast Intro Splash */}
      <div 
        className={`fixed inset-0 z-[200] bg-black flex items-center justify-center transition-opacity duration-700 ease-in-out ${!showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
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

      {/* Hero Section */}
      <section className="relative w-full h-full flex items-center">
        {/* Background Wall */}
        {wallPosters.length > 0 && <CinematicPosterWall posters={wallPosters} />}

        {/* Foreground Panel */}
        <div className="absolute right-0 bottom-0 md:top-0 w-full md:w-[45%] lg:w-[40%] h-[70%] md:h-full flex flex-col justify-end md:justify-center px-8 md:px-16 lg:px-24 pb-16 md:pb-0 z-20">
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-12"
          >
            <h1 className="text-white text-7xl md:text-8xl lg:text-[7rem] font-black lowercase tracking-tighter drop-shadow-2xl leading-none mb-6 md:mb-8">
              miyoro
            </h1>
            <div className="mt-4 space-y-1">
              <p className="text-white text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">Watch.</p>
              <p className="text-white/80 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">Whatever.</p>
              <p className="text-white/60 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">You Want.</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="w-full max-w-sm flex flex-col gap-8 border-t border-white/10 pt-8 mt-4"
          >
            {/* Account / Login Area */}
            {isLoggedIn ? (
              <div 
                onClick={() => navigate('/home')}
                className="flex items-center gap-4 group cursor-pointer w-max"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/40 transition-colors">
                  <User className="w-5 h-5 text-white/70 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg tracking-wide">{userProfile.name}</h3>
                  <p className="text-white/50 text-sm group-hover:text-white transition-colors flex items-center gap-1">
                    Your Profile <ChevronRight className="w-3 h-3" />
                  </p>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => navigate('/home')} // Route to auth/home
                className="text-left group flex flex-col gap-1 w-max"
              >
                <span className="text-white text-xl md:text-2xl font-semibold tracking-wide flex items-center gap-2">
                  Sign in <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </span>
                <div className="h-[2px] w-0 bg-white group-hover:w-full transition-all duration-300 ease-out" />
              </button>
            )}

            {/* Guest Entry */}
            <div 
              onClick={() => navigate('/home')}
              className="flex flex-col group cursor-pointer w-max mt-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              <h3 className="text-white/80 font-medium text-base mb-1">Guest</h3>
              <p className="text-white/40 text-sm group-hover:text-white/80 transition-colors flex items-center gap-1">
                Continue as Guest <ChevronRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
