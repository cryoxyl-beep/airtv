import React, { useEffect, useState, useRef, useCallback } from 'react';
import { IMAGE_BASE_URL, resolveLogo, getCachedLogo, fetchTrailer } from '../api/tmdb';
import { Play, ThumbsUp, ThumbsDown, Volume2, VolumeX, ListVideo, Plus } from 'lucide-react';
import { getVideoMutedPreference, setVideoMutedPreference } from '../utils/preferences';

interface WatchPageProps {
  onPlay?: () => void;
    item: any;
  type: 'movie' | 'tv' | 'anime';
  seasonNumber?: number;
  episodeNumber?: number;
  seasonData?: any;
  forceFullScreen?: boolean;
}

export default function WatchPage({ item, type, seasonNumber, episodeNumber, seasonData, forceFullScreen, onPlay }: WatchPageProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(getCachedLogo(item));
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const [trailerEnded, setTrailerEnded] = useState(false);
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [isMuted, setIsMuted] = useState(getVideoMutedPreference());
  const [initialMuted] = useState(isMuted);
  const [canReveal, setCanReveal] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isPlayingRef = useRef(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  
  useEffect(() => {
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    resolveLogo(item).then(url => {
      if (mounted && url) {
        setLogoUrl(url);
      }
    });
    
    const fetchT = item.source === 'anilist'
      ? Promise.resolve(item.trailer)
      : fetchTrailer(item.id, type === 'anime' ? 'tv' : type);
      
    fetchT.then(key => {
      if (mounted && key) {
        setTrailerKey(key);
      }
    });

    return () => { mounted = false; };
  }, [item, type]);

  useEffect(() => {
    if (!trailerKey) return;
    const timer = setTimeout(() => {
      setCanReveal(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [trailerKey]);

  useEffect(() => {
    if (!trailerKey) return;
    
    // Listen for YouTube postMessage API to know exactly when it starts playing or ends
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.event === 'onStateChange') {
          if (data.info === 1) { // playing
            setTrailerPlaying(true);
            isPlayingRef.current = true;
          } else if (data.info === 0) { // ended
            setTrailerEnded(true);
            setTrailerPlaying(false);
            setIsUiHidden(false); // Make UI permanently visible again
            isPlayingRef.current = false;
          }
        }
      } catch (e) {
        // ignore parse errors from other extensions/scripts
      }
    };

    window.addEventListener('message', handleMessage);

    

    

    let playerInitTimer: ReturnType<typeof setTimeout>;

    const initPlayer = () => {
      const yt = (window as any).YT;
      if (yt && yt.Player && iframeRef.current) {
        new yt.Player(iframeRef.current, {
          events: {
            onReady: (event: any) => {
              const duration = event.target.getDuration();
              const CUTOFF_BUFFER = 15;
              const cutoffDelay = Math.max(0, (duration - CUTOFF_BUFFER)) * 1000;
              
              if (duration > CUTOFF_BUFFER) {
                cutoffTimerRef.current = setTimeout(() => {
                  if (event.target && typeof event.target.stopVideo === 'function') {
                    event.target.stopVideo();
                  }
                  setTrailerEnded(true);
                  setTrailerPlaying(false);
                  setIsUiHidden(false);
                  isPlayingRef.current = false;
                }, cutoffDelay);
              }
            },
            onStateChange: (event: any) => {
              if (event.data === 1) {
                setTrailerPlaying(true);
                isPlayingRef.current = true;
              } else if (event.data === 0) {
                setTrailerEnded(true);
                setTrailerPlaying(false);
                setIsUiHidden(false);
                isPlayingRef.current = false;
              }
            }
          }
        });
      } else {
        playerInitTimer = setTimeout(initPlayer, 100);
      }
    };

    initPlayer();

    return () => {
      clearTimeout(playerInitTimer);
      if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);
      window.removeEventListener('message', handleMessage);
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        iframeRef.current.src = 'about:blank';
      }
    };
  }, [trailerKey]);

  const resetInactivityTimer = useCallback((delay: number) => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!isPlayingRef.current || trailerEnded) return;

    setIsUiHidden(false);
    inactivityTimerRef.current = setTimeout(() => {
      if (isPlayingRef.current && !trailerEnded) {
        setIsUiHidden(true);
      }
    }, delay);
  }, [trailerEnded]);

  // Initial inactivity timer when video starts
  useEffect(() => {
    if (trailerPlaying && !trailerEnded) {
      resetInactivityTimer(3000);
    } else {
      setIsUiHidden(false);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    }
  }, [trailerPlaying, trailerEnded, resetInactivityTimer]);

  
    const handleMouseMove = () => {
    if (trailerPlaying && !trailerEnded) {
      resetInactivityTimer(2000);
    }
  };

  const handleMouseLeave = () => {
    if (trailerPlaying && !trailerEnded) {
      setIsUiHidden(true);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setVideoMutedPreference(nextMuted);
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: nextMuted ? 'mute' : 'unMute', args: [] }),
      '*'
    );
  };

  // Determine the best backdrop to show while loading
  let backdropPath = item?.backdrop_path;
  const overviewText = item.overview;
  
  const isTrailerVisible = trailerPlaying && canReveal && !trailerEnded && trailerKey !== null;

  return (
    <div 
      className={`relative w-full bg-black overflow-hidden group ${type === 'movie' || forceFullScreen ? 'h-screen' : 'aspect-video md:aspect-[21/9] lg:aspect-[21/9] xl:aspect-[24/9]'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      
      {/* Layer 0: YouTube Player */}
      <div className={`absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden bg-black transition-opacity duration-700 ease-in-out ${trailerEnded ? 'opacity-0' : 'opacity-100'}`}>
        {trailerKey && !trailerEnded && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] md:w-[180%] aspect-video pointer-events-none">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${initialMuted ? 1 : 0}&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${window.location.origin}&cc_load_policy=0`}
              className="w-full h-full pointer-events-none object-cover"
              allow="autoplay; encrypted-media"
              tabIndex={-1}
            />
          </div>
        )}
      </div>

      {/* Layer 1: Static Backdrop Images */}
      <div className={`absolute inset-0 w-full h-full z-10 pointer-events-none transition-opacity duration-700 ease-in-out ${isTrailerVisible ? 'opacity-0' : 'opacity-100'}`}>
        {backdropPath ? (
          <img 
            src={(backdropPath?.startsWith('http') ? backdropPath : `${IMAGE_BASE_URL}${backdropPath}`)} 
            alt="Backdrop" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#111]" />
        )}
      </div>

      {/* Layer 2: Gradients */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: `
            linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 75%),
            linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 30%),
            linear-gradient(to top, #000 0px, rgba(0,0,0,0.98) 15px, rgba(0,0,0,0.85) 50px, rgba(0,0,0,0.5) 150px, rgba(0,0,0,0.1) 250px, transparent 300px)
          `,
        }}
      />

      {/* Mute/Unmute Button */}
      {isTrailerVisible && (
        <div className="absolute top-6 right-6 z-50 pointer-events-auto">
          <button
            onClick={toggleMute}
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Hero Content (Logo, Metadata, Description, Buttons) */}
      <div className="absolute inset-0 z-30 flex flex-col justify-end px-6 pb-6 pt-16 md:px-12 md:pb-10 lg:px-16 lg:pb-12 w-full pointer-events-none">
        <div className="flex flex-col items-start justify-end gap-3 md:gap-4 shrink-0 max-w-[500px] flex-1 pointer-events-none">
          
          <div className="transition-opacity duration-500 mb-1 md:mb-2">
            {logoUrl ? (
              <>
                <img 
                  src={logoUrl} 
                  alt={item.title || item.name} 
                  className="h-20 md:h-28 lg:h-36 max-w-[260px] md:max-w-[400px] lg:max-w-[480px] object-contain object-left drop-shadow-2xl"
                />
                {type === 'anime' && (
                  <p className="mt-2 text-white/90 text-sm md:text-base lg:text-lg font-bold tracking-wide drop-shadow-md">
                    {item.title || item.name}
                  </p>
                )}
              </>
            ) : (
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-white drop-shadow-lg text-left uppercase">
                {item.title || item.name}
              </h2>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm lg:text-[15px] text-white/90 drop-shadow-md font-medium">
            <span className="border border-white/40 text-white px-1.5 py-0.5 rounded-sm text-[10px] md:text-xs leading-none">
              {item.adult ? '18+' : '13+'}
            </span>
            {type === 'movie' && item.release_date && (
              <>
                <span>{new Date(item.release_date).getFullYear()}</span>
                <span className="text-white/40">&bull;</span>
                {item.runtime && (
                  <>
                    <span>{Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span>
                    <span className="text-white/40">&bull;</span>
                  </>
                )}
              </>
            )}
            {type === 'tv' && item.first_air_date && (
              <>
                <span>{new Date(item.first_air_date).getFullYear()}</span>
                <span className="text-white/40">&bull;</span>
              </>
            )}
            {type === 'anime' && (
              <>
                <span>{item.first_air_date ? new Date(item.first_air_date).getFullYear() : (item.release_date ? new Date(item.release_date).getFullYear() : '')}</span>
                <span className="text-white/40">&bull;</span>
              </>
            )}
            
            <div className="flex items-center gap-1.5">
              {item.genres?.slice(0, 3).map((g, i) => (
                <span key={g.id}>
                  {g.name}
                  {i < Math.min(item.genres.length, 3) - 1 ? ', ' : ''}
                </span>
              ))}
            </div>

            {type === 'tv' && item.number_of_seasons && (
              <>
                <span className="text-white/40">&bull;</span>
                <span>{item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}</span>
              </>
            )}
            {type === 'anime' && item.animeGroup && item.animeGroup.seasons && item.animeGroup.seasons.length > 1 && (
              <>
                <span className="text-white/40">&bull;</span>
                <span>{item.animeGroup.seasons.length} Seasons</span>
              </>
            )}
          </div>
          
          {overviewText && (
            <p className="text-xs md:text-sm lg:text-[15px] text-white/80 leading-relaxed line-clamp-3 md:line-clamp-4 drop-shadow-lg font-normal mb-1 md:mb-3 max-w-2xl lg:max-w-3xl">
              {overviewText}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 w-full pb-1 pointer-events-auto">
            <button onClick={() => onPlay && onPlay()} className="bg-white text-black px-6 py-2.5 md:px-8 md:py-3.5 rounded-full font-bold flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-2xl text-sm md:text-[15px]">
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-current text-black" /> 
              Watch Now
            </button>
            
            <div className="flex items-center gap-2 md:gap-3">
              <button 
                className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group ml-1"
                aria-label="Add to List"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </button>
              <button 
                onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
                className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
                aria-label="Like"
              >
                <ThumbsUp className={`w-4 h-4 md:w-5 md:h-5 ${feedback === 'like' ? 'fill-current text-white' : 'text-white'}`} />
              </button>
              <button 
                onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
                className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
                aria-label="Dislike"
              >
                <ThumbsDown className={`w-4 h-4 md:w-5 md:h-5 ${feedback === 'dislike' ? 'fill-current text-white' : 'text-white'}`} />
              </button>
            </div>
          </div>

        </div>
      </div>
      {/* Provider iframe removed, now in PlayerPage */}
    </div>
  );
}
