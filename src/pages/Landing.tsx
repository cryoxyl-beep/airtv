import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { fetchTop10, IMAGE_BASE_URL_W500, fetchTrending } from '../api/tmdb';
import { fetchTrendingAnime } from '../api/anilist';
import { ChevronRight, User } from 'lucide-react';

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

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
                className="flex items-center gap-4 group cursor-pointer w-max p-3 -ml-3 rounded-2xl hover:bg-white/5 transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:translate-x-2"
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
                onClick={(e) => {
                  e.preventDefault();
                  // Temporarily blocked per instructions
                }}
                className="text-left group flex flex-col gap-1 w-max cursor-not-allowed opacity-50 p-3 -ml-3 rounded-2xl hover:bg-white/5 transition-all duration-400 ease-out hover:translate-x-1"
                disabled
              >
                <span className="text-white text-xl md:text-2xl font-semibold tracking-wide flex items-center gap-3">
                  <GoogleIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                  Sign in with Google
                </span>
                <div className="h-[2px] w-0 bg-white group-hover:w-full transition-all duration-500 ease-out" />
              </button>
            )}

            {/* Guest Entry */}
            <div 
              onClick={() => navigate('/home')}
              className="flex items-center gap-4 group cursor-pointer w-max mt-2 p-3 -ml-3 rounded-2xl hover:bg-white/5 transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:translate-x-2"
            >
              <div className="w-12 h-12 rounded-full bg-[#141414] flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/40 transition-all duration-300 shadow-xl">
                <img 
                  src="https://api.dicebear.com/9.x/lorelei/svg?seed=Miyoro&backgroundColor=transparent" 
                  alt="Guest" 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                />
              </div>
              <div className="flex flex-col">
                <h3 className="text-white/90 font-medium text-lg tracking-wide group-hover:text-white transition-colors">Guest</h3>
                <p className="text-white/50 text-sm group-hover:text-white/90 transition-colors flex items-center gap-1">
                  Continue as Guest <ChevronRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform duration-300" />
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
