import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { fetchTop10, IMAGE_BASE_URL_W500, fetchTrending, preloadImageUrls } from '../api/tmdb';
import { fetchTrendingAnime } from '../api/anilist';
import { preloadHomeData } from './Home';
import { User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MiyoroSpinner } from '../components/MiyoroSpinner';
import { MiyoroWordmark } from '../components/MiyoroWordmark';

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const GuestSmileAvatar = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="34" cy="46" r="6.5" fill="currentColor" />
    <circle cx="86" cy="46" r="6.5" fill="currentColor" />
    <path
      d="M42 71C51 82 71 83 84 69"
      stroke="currentColor"
      strokeWidth="7.5"
      strokeLinecap="round"
    />
  </svg>
);

const CinematicPosterWall = ({ posters }: { posters: any[] }) => {
  const prefersReducedMotion = useReducedMotion();

  const cols = [[], [], [], []] as any[][];
  posters.forEach((p, i) => cols[i % 4].push(p));

  const durations = [45, 60, 50, 65];
  const directions = [
    ['0%', '-50%'],
    ['-50%', '0%'],
    ['0%', '-50%'],
    ['-50%', '0%'],
  ];

  return (
    <div className="absolute inset-0 w-full h-[130vh] -top-[15vh] overflow-hidden bg-black flex gap-3 md:gap-4 lg:gap-6 px-2 md:px-4 lg:px-8 opacity-45 md:opacity-55 pointer-events-none transform -skew-y-6 scale-[1.15]">
      {cols.map((col, i) => {
        const duplicatedCol = [...col, ...col];
        return (
          <div key={i} className={`flex-1 flex flex-col gap-3 md:gap-4 lg:gap-6 ${i > 1 ? 'hidden md:flex' : ''} ${i > 2 ? 'hidden lg:flex' : ''}`}>
            <motion.div
              className="flex flex-col gap-3 md:gap-4 lg:gap-6"
              animate={prefersReducedMotion ? {} : { y: directions[i] as any }}
              transition={{
                repeat: Infinity,
                ease: 'linear',
                duration: durations[i],
              }}
            >
              {duplicatedCol.map((poster, idx) => (
                <div key={idx} className="w-full relative rounded-xl md:rounded-2xl overflow-hidden aspect-[2/3] shadow-2xl">
                  {poster.poster_path ? (
                    <img
                      src={poster.poster_path.startsWith('http') ? poster.poster_path : `${IMAGE_BASE_URL_W500}${poster.poster_path}`}
                      alt={poster.title || 'Poster'}
                      className="w-full h-full object-cover"
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5" />
                  )}
                  <div className="absolute inset-0 bg-black/30" />
                </div>
              ))}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const [wallPosters, setWallPosters] = useState<any[]>([]);

  const { currentUser, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadLandingData = async () => {
      try {
        const [trendingRes, animeRes, moviesRes] = await Promise.all([
          fetchTop10(),
          fetchTrendingAnime(20, true),
          fetchTrending(),
        ]);

        const mixed = [
          ...(trendingRes.results || []),
          ...(animeRes.results || []),
          ...(moviesRes.results || []),
        ].filter((p) => p.poster_path);

        for (let i = mixed.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
        }

        const uniquePosters = mixed.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i).slice(0, 40);
        if (mounted) {
          setWallPosters(uniquePosters);
        }

        const posterUrls = uniquePosters.slice(0, 16).map((p) =>
          p.poster_path.startsWith('http') ? p.poster_path : `${IMAGE_BASE_URL_W500}${p.poster_path}`
        );
        await preloadImageUrls(posterUrls, 550);

        preloadHomeData().catch(() => {});
      } catch (err) {
        console.error('Error loading landing data:', err);
      }
    };
    loadLandingData();

    return () => {
      mounted = false;
    };
  }, []);

  const handleGoogleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSigningIn) return;

    setIsSigningIn(true);
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign in cancelled.');
      } else {
        setAuthError('Unable to sign in with Google. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="h-screen bg-black font-sans w-full overflow-hidden relative selection:bg-white/30 select-none">
      <section className="relative w-full h-full flex items-center justify-center">
        {/* Background Wall */}
        {wallPosters.length > 0 && <CinematicPosterWall posters={wallPosters} />}

        {/* Balanced Cinema Vignette Scrims */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/75 via-black/45 to-black/90"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_62%_58%_at_50%_48%,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.4)_65%,rgba(0,0,0,0.8)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-tr from-black/85 via-transparent to-transparent"
        />

        {/* Top-Left Brand Lockup */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08 }}
          className="absolute top-6 left-6 sm:top-8 sm:left-10 lg:top-10 lg:left-12 z-20 pointer-events-none"
        >
          <h1 className="sr-only">Miyoro — Watch. Whatever. You Want.</h1>
          <MiyoroWordmark
            variant="lockup"
            height={44}
            className="w-[155px] sm:w-[185px] lg:w-[210px] h-auto max-w-full text-white drop-shadow-[0_6px_22px_rgba(0,0,0,0.9)]"
          />
        </motion.div>

        {/* Bottom-Left Editorial Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.25 }}
          className="absolute bottom-6 left-6 sm:bottom-9 sm:left-10 lg:bottom-11 lg:left-12 z-20 pointer-events-none"
        >
          <div className="space-y-0.5 sm:space-y-1">
            <p className="text-white text-2xl sm:text-3xl lg:text-[2.15rem] font-bold tracking-tight leading-[1.08] drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
              Watch.
            </p>
            <p className="text-white/75 text-2xl sm:text-3xl lg:text-[2.15rem] font-bold tracking-tight leading-[1.08] drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
              Whatever.
            </p>
            <p className="text-white/45 text-2xl sm:text-3xl lg:text-[2.15rem] font-bold tracking-tight leading-[1.08] drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
              You Want.
            </p>
          </div>
        </motion.div>

        {/* Center Netflix-Style Profile Selection */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.75, delay: 0.16 }}
          className="relative z-20 flex flex-col items-center justify-center px-6 pb-28 sm:pb-24 md:pb-4"
        >
          <h2 className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-[2.65rem] font-semibold tracking-tight mb-7 sm:mb-10 text-center drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
            Who&apos;s watching?
          </h2>

          <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-10 md:gap-12">
            {/* Tile 1: Signed-in User OR Sign in with Google */}
            {currentUser ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="group flex flex-col items-center cursor-pointer focus:outline-none"
              >
                <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-[#232630] to-[#121319] border-2 border-white/15 ring-1 ring-inset ring-white/10 group-hover:border-white group-focus-visible:border-white group-hover:scale-105 group-active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] shadow-[0_14px_40px_rgba(0,0,0,0.85)] group-hover:shadow-[0_18px_48px_rgba(0,0,0,0.9),0_0_26px_rgba(255,255,255,0.16)] flex items-center justify-center">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 sm:w-14 sm:h-14 text-white/80 group-hover:text-white transition-colors" />
                  )}
                </div>
                <span className="mt-3.5 sm:mt-4 text-sm sm:text-base font-medium text-white/70 group-hover:text-white transition-colors max-w-[140px] sm:max-w-[160px] truncate text-center">
                  {currentUser.displayName || 'Continue'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSigningIn}
                aria-busy={isSigningIn}
                className={`group flex flex-col items-center focus:outline-none ${
                  isSigningIn ? 'cursor-wait opacity-85' : 'cursor-pointer'
                }`}
              >
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl overflow-hidden bg-gradient-to-b from-[#232632] via-[#171922] to-[#0D0E13] border-2 border-white/15 ring-1 ring-inset ring-white/10 group-hover:border-white group-focus-visible:border-white group-hover:scale-105 group-active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] shadow-[0_14px_40px_rgba(0,0,0,0.85)] group-hover:shadow-[0_18px_48px_rgba(0,0,0,0.9),0_0_26px_rgba(255,255,255,0.16)] flex items-center justify-center backdrop-blur-md">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10)_0%,transparent_70%)] opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  {isSigningIn ? (
                    <MiyoroSpinner size={44} color="#ffffff" label="Signing in" />
                  ) : (
                    <GoogleIcon className="relative z-10 w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 text-white/90 group-hover:text-white transition-transform duration-200 group-hover:scale-105 drop-shadow-[0_4px_14px_rgba(0,0,0,0.65)]" />
                  )}
                </div>
                <span className="mt-3.5 sm:mt-4 text-sm sm:text-base font-medium text-white/70 group-hover:text-white transition-colors text-center">
                  {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>
            )}

            {/* Tile 2: Guest Profile */}
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="group flex flex-col items-center cursor-pointer focus:outline-none"
            >
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl overflow-hidden bg-gradient-to-b from-[#2F4773] via-[#1E2E4D] to-[#111B2E] border-2 border-white/15 ring-1 ring-inset ring-white/10 group-hover:border-white group-focus-visible:border-white group-hover:scale-105 group-active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] shadow-[0_14px_40px_rgba(0,0,0,0.85)] group-hover:shadow-[0_18px_48px_rgba(0,0,0,0.9),0_0_26px_rgba(255,255,255,0.16)] flex items-center justify-center">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.14)_0%,transparent_72%)] opacity-75 group-hover:opacity-100 transition-opacity"
                />
                <GuestSmileAvatar className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-white/95 group-hover:text-white transition-transform duration-200 group-hover:scale-105 drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)]" />
              </div>
              <span className="mt-3.5 sm:mt-4 text-sm sm:text-base font-medium text-white/70 group-hover:text-white transition-colors text-center">
                Guest
              </span>
            </button>
          </div>

          {authError && (
            <p className="mt-5 text-red-400 text-xs sm:text-sm text-center drop-shadow">
              {authError}
            </p>
          )}
        </motion.div>
      </section>
    </div>
  );
}
