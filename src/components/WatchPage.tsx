import React, { useEffect, useState, useRef, useCallback } from 'react';
import { IMAGE_BASE_URL, resolveLogo, getCachedLogo, fetchTrailer } from '../api/tmdb';
import { Play, Volume2, VolumeX, RotateCcw, Layers } from 'lucide-react';
import {
  getVideoMutedPreference,
  setVideoMutedPreference,
} from '../utils/preferences';

interface WatchPageProps {
  item: any;
  type: 'movie' | 'tv' | 'anime';
  seasonNumber?: number;
  episodeNumber?: number;
  seasonData?: any;
  hasProgress?: boolean;
  progressPercent?: number;
  isPopoverOpen?: boolean;
  onPlay?: () => void;
  onPlayFromBeginning?: () => void;
  onOpenMoreEpisodes?: () => void;
}

function resolveMaturityRating(item: any, type: 'movie' | 'tv' | 'anime'): string {
  if (item?.adult || item?.anilist_raw?.isAdult) {
    return '18+';
  }

  // Check TMDB content_ratings (TV) or release_dates (Movie) if present
  const tvRatings = item?.content_ratings?.results;
  if (Array.isArray(tvRatings) && tvRatings.length > 0) {
    const usOrIn =
      tvRatings.find((r: any) => r.iso_3166_1 === 'IN' && r.rating) ||
      tvRatings.find((r: any) => r.iso_3166_1 === 'US' && r.rating) ||
      tvRatings.find((r: any) => r.rating);
    if (usOrIn?.rating) return usOrIn.rating;
  }

  const movieReleases = item?.release_dates?.results;
  if (Array.isArray(movieReleases) && movieReleases.length > 0) {
    for (const code of ['IN', 'US', 'GB']) {
      const country = movieReleases.find((r: any) => r.iso_3166_1 === code);
      const cert = country?.release_dates?.find((d: any) => d.certification)?.certification;
      if (cert) return cert;
    }
  }

  // Derive sensible age rating from genres if explicit certification wasn't appended
  const genreNames = (item?.genres || []).map((g: any) => (g.name || g || '').toLowerCase());
  if (
    genreNames.some((g: string) =>
      ['horror', 'thriller', 'crime', 'psychological', 'mystery'].includes(g)
    )
  ) {
    return 'U/A 16+';
  }
  return type === 'anime' ? 'U/A 13+' : 'U/A 13+';
}

export default function WatchPage({
  item,
  type,
  seasonNumber = 1,
  episodeNumber = 1,
  seasonData,
  hasProgress = false,
  progressPercent = 0.35,
  isPopoverOpen = false,
  onPlay,
  onPlayFromBeginning,
  onOpenMoreEpisodes,
}: WatchPageProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(
    () => getCachedLogo(item) || item?.logo_path || null
  );

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
    if (!iframeRef.current?.contentWindow) return;
    if (isPopoverOpen) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } else if (isPlayingRef.current && !trailerEnded) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
    }
  }, [isPopoverOpen, trailerEnded]);

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
    const initial = getCachedLogo(item) || item?.logo_path || null;
    if (initial) setLogoUrl(initial);

    resolveLogo(item).then((url) => {
      if (mounted && url) {
        setLogoUrl(url);
      }
    });

    const fetchT =
      item.source === 'anilist'
        ? Promise.resolve(item.trailer)
        : fetchTrailer(item.id, type === 'anime' ? 'tv' : type);

    fetchT.then((key) => {
      if (mounted && key) {
        setTrailerKey(key);
      }
    });

    return () => {
      mounted = false;
    };
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
          if (data.info === 1) {
            setTrailerPlaying(true);
            isPlayingRef.current = true;
          } else if (data.info === 0) {
            setTrailerEnded(true);
            setTrailerPlaying(false);
            setIsUiHidden(false);
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
              const cutoffDelay = Math.max(0, duration - CUTOFF_BUFFER) * 1000;

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
            },
          },
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
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
        iframeRef.current.src = 'about:blank';
      }
    };
  }, [trailerKey]);

  const resetInactivityTimer = useCallback(
    (delay: number) => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (!isPlayingRef.current || trailerEnded) return;

      setIsUiHidden(false);
      inactivityTimerRef.current = setTimeout(() => {
        if (isPlayingRef.current && !trailerEnded) {
          setIsUiHidden(true);
        }
      }, delay);
    },
    [trailerEnded]
  );

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

  // Determine backdrop and current episode metadata
  const backdropPath = item?.backdrop_path;
  const isTrailerVisible = trailerPlaying && canReveal && !trailerEnded && trailerKey !== null;

  // Always show only the series or anime or movie description, never episode titles or descriptions
  const overviewText = item?.overview || '';

  // Metadata fields based on content type
  const releaseYear = item?.first_air_date
    ? new Date(item.first_air_date).getFullYear()
    : item?.release_date
    ? new Date(item.release_date).getFullYear()
    : item?.anilist_raw?.seasonYear || '';

  const primaryGenre = item?.genres?.[0]?.name || '';
  const totalAnimeEpisodes =
    item?.number_of_episodes ||
    item?.anilist_raw?.episodes ||
    seasonData?.episodes?.length ||
    null;

  const maturityRating = resolveMaturityRating(item, type);

  // Primary button label
  let primaryButtonLabel = 'Watch Now';
  if (hasProgress) {
    if (type === 'tv') {
      primaryButtonLabel = `Resume S${seasonNumber}: Ep. ${episodeNumber}`;
    } else if (type === 'anime') {
      primaryButtonLabel = `Resume Episode ${episodeNumber}`;
    } else {
      primaryButtonLabel = 'Resume';
    }
  }

  return (
    <div
      className="relative w-full h-screen min-h-[680px] bg-black overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Layer 0: YouTube Trailer Player */}
      <div
        className={`absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden bg-black transition-opacity duration-700 ease-in-out ${
          trailerEnded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {trailerKey && !trailerEnded && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] md:w-[175%] lg:w-[145%] aspect-video pointer-events-none">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${
                initialMuted ? 1 : 0
              }&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${
                window.location.origin
              }&cc_load_policy=0`}
              className="w-full h-full pointer-events-none object-cover"
              allow="autoplay; encrypted-media"
              tabIndex={-1}
            />
          </div>
        )}
      </div>

      {/* Layer 1: Static Backdrop Image */}
      <div
        className={`absolute inset-0 w-full h-full z-10 pointer-events-none transition-opacity duration-700 ease-in-out ${
          isTrailerVisible ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {backdropPath ? (
          <img
            src={backdropPath.startsWith('http') ? backdropPath : `${IMAGE_BASE_URL}${backdropPath}`}
            alt={item?.title || item?.name || 'Backdrop'}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-[#111]" />
        )}
      </div>

      {/* Layer 2: Directional Left & Bottom Gradients (Center and Right remain naturally illuminated) */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: `
            linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.68) 24%, rgba(0,0,0,0.30) 46%, rgba(0,0,0,0.06) 64%, transparent 78%),
            linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.42) 16%, transparent 38%),
            linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, transparent 18%)
          `,
        }}
      />

      {/* Mute/Unmute Button */}
      {isTrailerVisible && (
        <div className="absolute top-6 right-6 z-50 pointer-events-auto">
          <button
            onClick={toggleMute}
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Left-Side Cinematic Information Stack */}
      <div className="absolute inset-0 z-30 flex flex-col justify-center px-6 pt-20 pb-10 md:px-14 lg:px-20 w-full pointer-events-none">
        <div className="flex flex-col items-start justify-center gap-3 md:gap-3.5 max-w-[480px] lg:max-w-[520px] w-full pointer-events-none">
          {/* 2A. HD Clear Logo (or Plain Text Fallback ONLY when logo is unavailable) */}
          <div className="mb-1 md:mb-2 min-h-[44px] flex items-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={typeof item?.title === 'string' ? item.title : item?.title?.english || item?.name || 'Title'}
                onError={() => {
                  setLogoUrl(null);
                }}
                className="max-h-20 md:max-h-28 lg:max-h-32 w-auto max-w-[260px] md:max-w-[380px] lg:max-w-[440px] object-contain object-left drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)]"
              />
            ) : (
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white drop-shadow-xl text-left">
                {typeof item?.title === 'string' ? item.title : item?.title?.english || item?.title?.romaji || item?.name || 'Overview'}
              </h1>
            )}
          </div>

          {/* 2B. Metadata Row (with age rating replacing the HD badge) */}
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-semibold text-white/90 drop-shadow">
            {releaseYear && (
              <>
                <span>{releaseYear}</span>
                <span className="text-white/45">&bull;</span>
              </>
            )}

            <span>
              {type === 'anime' ? 'Anime' : type === 'tv' ? 'Series' : 'Movie'}
            </span>

            {type === 'anime' && totalAnimeEpisodes && (
              <>
                <span className="text-white/45">&bull;</span>
                <span>{totalAnimeEpisodes} Episodes</span>
              </>
            )}

            {type === 'tv' && item?.number_of_seasons && (
              <>
                <span className="text-white/45">&bull;</span>
                <span>
                  {item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}
                </span>
              </>
            )}

            {type === 'movie' && item?.runtime ? (
              <>
                <span className="text-white/45">&bull;</span>
                <span>
                  {Math.floor(item.runtime / 60)}h {item.runtime % 60}m
                </span>
              </>
            ) : null}

            {primaryGenre && (
              <>
                <span className="text-white/45">&bull;</span>
                <span>{primaryGenre}</span>
              </>
            )}

            {/* Age Rating Box Badge replacing the HD badge */}
            <span className="ml-1 px-1.5 py-0.5 text-[10px] md:text-[11px] font-bold tracking-wider uppercase border border-white/40 rounded-[3px] text-white/95 leading-none">
              {maturityRating}
            </span>
          </div>

          {/* 2C. Series/Anime Description only (no episode titles or episode synopses) */}
          {overviewText && (
            <p className="text-xs md:text-sm lg:text-[15px] text-white/85 leading-relaxed line-clamp-3 md:line-clamp-4 drop-shadow-md font-normal max-w-[480px] my-1">
              {overviewText}
            </p>
          )}

          {/* 2D. Watching Controls Stack (No like/dislike/library row, No progress bar) */}
          <div className="flex flex-col items-start gap-2.5 w-full max-w-[360px] pt-2 pointer-events-auto">
            {/* Primary Action Button (White Pill Button without progress bar) */}
            <button
              onClick={() => onPlay && onPlay()}
              className="w-full bg-white hover:bg-white/90 text-black px-4 py-3 md:py-3.5 rounded-full font-bold flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.99] shadow-[0_8px_30px_rgba(0,0,0,0.6)] text-sm md:text-[15px]"
            >
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-current text-black shrink-0" />
              <span>{primaryButtonLabel}</span>
            </button>

            {/* Secondary Action: Play From Beginning */}
            <button
              onClick={() => onPlayFromBeginning && onPlayFromBeginning()}
              className="w-full px-4 py-2.5 rounded-full text-white/85 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3 text-sm md:text-[15px] font-medium"
            >
              <RotateCcw className="w-4 h-4 md:w-5 md:h-5 text-white/80 shrink-0" />
              <span>Play From Beginning</span>
            </button>

            {/* More Episodes Action (Shown for Anime and TV Series ONLY — Never for Movies) */}
            {(type === 'anime' || type === 'tv') && (
              <button
                onClick={() => onOpenMoreEpisodes && onOpenMoreEpisodes()}
                className="w-full px-4 py-2.5 rounded-full text-white/85 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3 text-sm md:text-[15px] font-medium"
              >
                <Layers className="w-4 h-4 md:w-5 md:h-5 text-white/80 shrink-0" />
                <span>More Episodes</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
