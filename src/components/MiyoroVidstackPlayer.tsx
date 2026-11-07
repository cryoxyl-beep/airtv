import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  MediaPlayer,
  MediaProvider,
  Track,
  Captions,
  MediaPlayerInstance,
  isHLSProvider,
  isDASHProvider,
  MediaTimeUpdateEventDetail,
} from '@vidstack/react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  ArrowLeft,
  ChevronUp,
  SkipForward,
  Check,
  Search,
  X,
} from 'lucide-react';
import { MovySource, MovySubtitle } from '../api/movy';
import { getVideoMutedPreference, setVideoMutedPreference } from '../utils/preferences';
import MiyoroLoader from './MiyoroLoader';
import * as dashjs from 'dashjs';
import Hls from 'hls.js';

if (typeof window !== 'undefined' && !(window as any).dashjs) {
  (window as any).dashjs = (dashjs as any).default || dashjs;
}

// Movy rotates CDN hosts. Add new ones here as they appear.
const MOVY_CDN_PATTERNS = [
  'finalsignal.top',
  'goldenkite.top',
  'urbanmesa.top',
  'anipixcdn.co',
  'wellsrobertsonkmlt.workers.dev',
];

function isMovyCdnUrl(url: string): boolean {
  return MOVY_CDN_PATTERNS.some((p) => url.includes(p));
}

function proxyWrap(url: string): string {
  const cleaned = url.replace(/&amp;/g, '&');
  return `https://movy-scraper.vercel.app/api/stream?url=${encodeURIComponent(cleaned)}`;
}

// Custom hls.js loader that wraps movy CDN URLs through /api/stream
class ProxyHlsLoader extends Hls.DefaultConfig.loader {
  load(context: any, config: any, callbacks: any) {
    const url = context.url;
    if (url && !url.includes('/api/stream?url=') && isMovyCdnUrl(url)) {
      context.url = proxyWrap(url);
    }
    super.load(context, config, callbacks);
  }
}

// Custom Icons matching Image 1 Reference
function Rewind10Icon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4V1L8 5l4 4V6a7 7 0 1 1-7 7" />
      <text x="12" y="15.5" fontSize="6.5" fontWeight="bold" fill="currentColor" stroke="none" textAnchor="middle">10</text>
    </svg>
  );
}

function Forward10Icon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4V1l4 4-4 4V6a7 7 0 1 0 7 7" />
      <text x="12" y="15.5" fontSize="6.5" fontWeight="bold" fill="currentColor" stroke="none" textAnchor="middle">10</text>
    </svg>
  );
}

function QualityServerIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="14" rx="3" />
      <polygon points="10 8.5 15.5 11 10 13.5 10 8.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CCIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M10 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2" />
      <path d="M16 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2" />
    </svg>
  );
}

export interface MiyoroVidstackPlayerProps {
  sources: MovySource[];
  subtitles?: MovySubtitle[];
  title: string;
  poster?: string;
  initialTime?: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  episodeTitle?: string;
  provider?: string;
  onSelectProvider?: (provider: any) => void;
  onProgress?: (currentTime: number, duration: number, progress: number) => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  onOpenEpisodes?: () => void;
  onBack?: () => void;
  serverSelector?: React.ReactNode;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function MiyoroVidstackPlayer({
  sources,
  subtitles = [],
  title,
  poster,
  initialTime = 0,
  type,
  season,
  episode,
  episodeTitle,
  provider = 'miyoro',
  onSelectProvider,
  onProgress,
  onEnded,
  onError,
  onNextEpisode,
  hasNextEpisode,
  onOpenEpisodes,
  onBack,
  serverSelector,
}: MiyoroVidstackPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [currentSourceIndex, setCurrentSourceIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [isChangingSource, setIsChangingSource] = useState<boolean>(false);
  const [showBufferingOverlay, setShowBufferingOverlay] = useState<boolean>(false);

  // Subtitle state: auto-detect English if available
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(() => {
    if (!subtitles || subtitles.length === 0) return null;
    const eng = subtitles.find(
      (s) => s.lang?.toLowerCase().startsWith('en') || s.language?.toLowerCase().includes('english')
    );
    return eng ? (eng.lang || eng.language) : null;
  });
  const [subtitleSearch, setSubtitleSearch] = useState<string>('');

  // Top and bottom floating panels
  const [activeModal, setActiveModal] = useState<'quality' | 'subtitles' | 'settings' | null>(null);

  // UI autohide state
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Timeline scrub state
  const [isDraggingSeek, setIsDraggingSeek] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);

  // Refs for tracking
  const lastSavedTimeRef = useRef<number>(0);
  const savedResumeTimeRef = useRef<number>(initialTime);
  const resumedRef = useRef<boolean>(false);

  // Validate active source
  const safeSourceIndex = Math.min(Math.max(0, currentSourceIndex), Math.max(0, sources.length - 1));
  const activeSource: MovySource | undefined = sources[safeSourceIndex] || sources[0];

  const proxyUrl = activeSource?.url ? proxyWrap(activeSource.url) : '';
  const sourceType = activeSource?.format === 'hls'
    ? 'application/x-mpegurl'
    : activeSource?.format === 'dash'
      ? 'application/dash+xml'
      : 'video/mp4';

  // Autohide controls after ~3s of inactivity during playback
  const showControlsTemporarily = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      // Don't autohide if paused, seeking, or if any modal is open
      if (isPlaying && !activeModal && !isDraggingSeek) {
        setIsControlsVisible(false);
      }
    }, 3200);
  }, [isPlaying, activeModal, isDraggingSeek]);

  // 300ms debounce for playback buffering overlay so tiny stalls don't flicker
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isBuffering && !isStreamLoading && !isChangingSource) {
      timer = setTimeout(() => {
        setShowBufferingOverlay(true);
      }, 300);
    } else {
      setShowBufferingOverlay(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isBuffering, isStreamLoading, isChangingSource]);

  const handleMouseMove = () => {
    showControlsTemporarily();
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playerRef.current.paused) {
      playerRef.current.play().catch(() => {});
    } else {
      playerRef.current.pause();
    }
    showControlsTemporarily();
  };

  // Seek relative
  const seekRelative = (deltaSeconds: number) => {
    if (!playerRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    playerRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    showControlsTemporarily();
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      showControlsTemporarily();

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'arrowup':
          e.preventDefault();
          if (playerRef.current) {
            const newVol = Math.min(1, volume + 0.1);
            playerRef.current.volume = newVol;
            setVolume(newVol);
            if (isMuted) {
              playerRef.current.muted = false;
              setIsMuted(false);
              setVideoMutedPreference(false);
            }
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          if (playerRef.current) {
            const newVol = Math.max(0, volume - 0.1);
            playerRef.current.volume = newVol;
            setVolume(newVol);
            if (newVol === 0 && !isMuted) {
              playerRef.current.muted = true;
              setIsMuted(true);
              setVideoMutedPreference(true);
            }
          }
          break;
        case 'm':
          e.preventDefault();
          if (playerRef.current) {
            const nextMuted = !isMuted;
            playerRef.current.muted = nextMuted;
            setIsMuted(nextMuted);
            setVideoMutedPreference(nextMuted);
          }
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'escape':
          if (activeModal) {
            e.preventDefault();
            setActiveModal(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isMuted, isPlaying, duration, currentTime, activeModal, showControlsTemporarily]);

  // Provider configuration with CDN URL rewrite request filters
  const handleProviderChange = (p: any) => {
    if (!p) return;

    if ((p as any).video) {
      (p as any).video.crossOrigin = 'anonymous';
    }

    if (isHLSProvider(p)) {
      (p as any).config = {
        manifestLoadingTimeOut: 60000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 60000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 60000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        audioTrackLoadingTimeOut: 60000,
        audioTrackLoadingMaxRetry: 4,
        audioTrackLoadingRetryDelay: 1000,
        loader: ProxyHlsLoader as any,
      };
    }

    if (isDASHProvider(p)) {
      p.config = {
        streaming: {},
      };
    }
  };

  // CanPlay: Resume previous playback position and trigger autoplay (muted)
  const handleCanPlay = () => {
    setIsBuffering(false);
    setIsChangingSource(false);

    const targetResume = savedResumeTimeRef.current;
    if (targetResume > 5 && playerRef.current) {
      try {
        playerRef.current.currentTime = targetResume;
        savedResumeTimeRef.current = 0;
        resumedRef.current = true;
      } catch (err) {
        console.warn('Seeking to resume position failed:', err);
      }
    }

    if (playerRef.current) {
      playerRef.current.muted = true;
      playerRef.current.play().catch(() => {});
    }
  };

  // Immediate autoplay trigger when source changes
  useEffect(() => {
    setIsStreamLoading(true);
    setIsBuffering(false);
    setShowBufferingOverlay(false);
    if (playerRef.current && proxyUrl) {
      playerRef.current.muted = true;
      playerRef.current.play().catch(() => {});
    }
  }, [proxyUrl]);

  // Synchronize native HTML5 video <track> elements with /api/play subtitles
  useEffect(() => {
    if (!subtitles || subtitles.length === 0) return;
    const video = containerRef.current?.querySelector('video');
    if (!video) return;

    video.crossOrigin = 'anonymous';

    const existingTracks = Array.from(video.querySelectorAll('track'));
    const existingUrls = new Set(existingTracks.map((t) => t.src));

    subtitles.forEach((sub) => {
      if (!existingUrls.has(sub.url)) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = sub.language || sub.lang;
        track.srclang = sub.lang;
        track.src = sub.url;
        if (selectedSubtitle && (sub.lang === selectedSubtitle || sub.language === selectedSubtitle)) {
          track.default = true;
        }
        video.appendChild(track);
      }
    });

    if (video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (
          selectedSubtitle &&
          (track.language === selectedSubtitle || track.label === selectedSubtitle)
        ) {
          track.mode = 'showing';
        } else {
          track.mode = 'disabled';
        }
      }
    }
  }, [subtitles, proxyUrl, selectedSubtitle]);

  // Handle switching subtitle language or turning off
  const handleSelectSubtitle = (sub: MovySubtitle | null) => {
    const code = sub ? (sub.lang || sub.language) : null;
    setSelectedSubtitle(code);

    const video = containerRef.current?.querySelector('video');
    if (video && video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (code && (track.language === sub?.lang || track.label === sub?.language || track.label === sub?.lang)) {
          track.mode = 'showing';
        } else {
          track.mode = 'disabled';
        }
      }
    }

    if (playerRef.current?.textTracks) {
      for (const track of playerRef.current.textTracks) {
        if (code && (track.language === sub?.lang || track.label === sub?.language || track.label === sub?.lang)) {
          track.mode = 'showing';
        } else {
          track.mode = 'disabled';
        }
      }
    }

    setActiveModal(null);
  };

  // Periodic time updates
  const handleTimeUpdate = (detail: MediaTimeUpdateEventDetail) => {
    const cur = detail.currentTime;
    setCurrentTime(cur);

    const dur = playerRef.current?.duration || duration;
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
    }

    if (playerRef.current?.state?.bufferedEnd) {
      setBufferedEnd(playerRef.current.state.bufferedEnd);
    }

    if (onProgress && dur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 2) {
      lastSavedTimeRef.current = cur;
      const progress = Math.min(1, Math.max(0, cur / dur));
      onProgress(cur, dur, progress);
    }
  };

  // Timeline scrub handling
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    if (playerRef.current && duration > 0) {
      playerRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      showControlsTemporarily();
    }
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio);
    setHoverTime(ratio * duration);
  };

  const handleTimelineMouseLeave = () => {
    setHoverPosition(null);
  };

  // Select stream quality
  const handleSelectQuality = (index: number) => {
    if (index === safeSourceIndex) {
      setActiveModal(null);
      return;
    }
    savedResumeTimeRef.current = currentTime;
    setIsChangingSource(true);
    setIsStreamLoading(true);
    setCurrentSourceIndex(index);
    setActiveModal(null);
  };

  // Select playback speed
  const handleSelectRate = (rate: number) => {
    if (playerRef.current) {
      playerRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setActiveModal(null);
  };

  // Filter subtitles based on search input
  const filteredSubtitles = subtitles.filter((sub) => {
    if (!subtitleSearch.trim()) return true;
    const q = subtitleSearch.toLowerCase();
    return (
      (sub.language && sub.language.toLowerCase().includes(q)) ||
      (sub.lang && sub.lang.toLowerCase().includes(q))
    );
  });

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  // Remaining duration for bottom-right timestamp matching Image 1
  const remainingTimeStr = duration > 0 ? formatTime(Math.max(0, duration - currentTime)) : formatTime(duration);

  // Formatted series metadata for top-left (e.g., "S1 · E1 · Pilot")
  const seriesSubtitleParts: string[] = [];
  if (type === 'tv') {
    if (season !== undefined) seriesSubtitleParts.push(`S${season}`);
    if (episode !== undefined) seriesSubtitleParts.push(`E${episode}`);
    if (episodeTitle) seriesSubtitleParts.push(episodeTitle);
  }
  const seriesSubtitle = seriesSubtitleParts.join(' · ');

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying && !activeModal) {
          setIsControlsVisible(false);
        }
      }}
      className="relative w-full h-full bg-black select-none overflow-hidden font-sans group/player cursor-default"
    >
      {/* 1. VIDSTACK HEADLESS MEDIA PLAYER */}
      {proxyUrl && (
        <MediaPlayer
          ref={playerRef}
          key={`movy-${proxyUrl}`}
          title={title}
          src={{
            src: proxyUrl,
            type: sourceType,
          }}
          poster={poster}
          crossOrigin="anonymous"
          autoPlay
          playsInline
          muted={isMuted}
          onProviderChange={handleProviderChange}
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => {
            setIsPlaying(true);
            showControlsTemporarily();
          }}
          onPause={() => {
            setIsPlaying(false);
            setIsControlsVisible(true);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsPlaying(true);
            setIsStreamLoading(false);
            setIsBuffering(false);
            setIsChangingSource(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (onEnded) onEnded();
          }}
          onError={(err) => {
            console.error('Vidstack player playback error:', err);
            setIsStreamLoading(false);
            setIsBuffering(false);
            setIsChangingSource(false);
            if (onError) onError(err);
          }}
          className="w-full h-full object-contain"
        >
          <MediaProvider className="w-full h-full">
            {subtitles &&
              subtitles.map((sub, idx) => (
                <Track
                  key={`vds-sub-${sub.lang || sub.language}-${idx}`}
                  src={sub.url}
                  kind="subtitles"
                  label={sub.language || sub.lang}
                  lang={sub.lang}
                  type="vtt"
                  default={selectedSubtitle === (sub.lang || sub.language)}
                />
              ))}
          </MediaProvider>
          <Captions className="vds-captions" />
        </MediaPlayer>
      )}

      {/* 2. CENTRAL CLICK & GESTURE SURFACE */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            togglePlay();
          }
        }}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (clickX < rect.width * 0.4) {
            seekRelative(-10);
          } else if (clickX > rect.width * 0.6) {
            seekRelative(10);
          } else {
            toggleFullscreen();
          }
        }}
        className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer"
      >
        {/* 3. PROMINENT CIRCULAR PLAY BUTTON IN CENTER (Visible when paused, matching Image 1) */}
        {!isPlaying && !isBuffering && !isChangingSource && !isStreamLoading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 hover:border-white/40 backdrop-blur-md flex items-center justify-center text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer z-30"
            aria-label="Play Video"
          >
            <Play className="w-8 h-8 md:w-9 md:h-9 fill-white text-white translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Stream first loading or quality/server change: solid black background */}
      {(isStreamLoading || isChangingSource) && (
        <div className="absolute inset-0 z-25 bg-black flex items-center justify-center">
          <MiyoroLoader size={96} color="#ffffff" />
        </div>
      )}

      {/* Playback buffering: semi-transparent black background (~40%) after 300ms delay, does NOT block controls */}
      {showBufferingOverlay && !isStreamLoading && !isChangingSource && (
        <div className="absolute inset-0 z-25 bg-black/40 flex items-center justify-center pointer-events-none">
          <MiyoroLoader size={96} color="#ffffff" />
        </div>
      )}

      {/* 4. FLOATING TOP OVERLAY (Matching Image 1) */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 pt-6 pb-20 px-6 md:px-10 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-start justify-between transition-opacity duration-300 pointer-events-none ${
          isControlsVisible || !isPlaying || activeModal
            ? 'opacity-100'
            : 'opacity-0'
        }`}
      >
        {/* Top-Left: Back Button + Title + S1 · E1 · Pilot */}
        <div className="flex items-start gap-4 pointer-events-auto">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-1 p-1 -ml-1 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Go Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
          )}

          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight leading-snug drop-shadow-md">
              {title}
            </h1>
            {seriesSubtitle && (
              <span className="text-xs md:text-sm font-medium text-white/70 tracking-normal mt-0.5 drop-shadow">
                {seriesSubtitle}
              </span>
            )}
          </div>
        </div>

        {/* Top-Right: Quality & Server | Audio & Subtitles | Next Episode */}
        <div className="relative flex items-center gap-2 sm:gap-4 md:gap-6 pointer-events-auto">
          {/* Quality & Server Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveModal(activeModal === 'quality' ? null : 'quality')}
              className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${
                activeModal === 'quality'
                  ? 'bg-white/20 text-white'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <QualityServerIcon className="w-4 h-4 text-white" />
              <span className="font-semibold">Quality & Server</span>
              <span className="text-white/60 hidden sm:inline text-xs">
                {activeSource?.quality ? `Auto · ${activeSource.quality}` : 'Auto'}
              </span>
            </button>

            {/* Quality & Server Floating Panel */}
            {activeModal === 'quality' && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#121212]/95 border border-white/15 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden z-50 p-3 text-white animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 px-1">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Quality & Server</span>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stream Quality Options */}
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block px-1 mb-1">
                    Stream Quality
                  </span>
                  <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
                    {sources.map((src, idx) => (
                      <button
                        key={`quality-${src.quality}-${idx}`}
                        type="button"
                        onClick={() => handleSelectQuality(idx)}
                        className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          idx === safeSourceIndex
                            ? 'bg-white text-black font-bold shadow-md'
                            : 'hover:bg-white/10 text-white/80 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{src.quality}</span>
                          <span className="text-[10px] uppercase opacity-60">({src.format})</span>
                        </span>
                        {idx === safeSourceIndex && <Check className="w-4 h-4 stroke-[2.5]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Server Selection */}
                {onSelectProvider && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block px-1 mb-1">
                      Streaming Server
                    </span>
                    <div className="flex flex-col gap-1">
                      {[
                        { id: 'miyoro', label: 'Miyoro (Native DASH / HLS)' },
                        { id: 'vidly', label: 'Vidly (Embed Provider)' },
                        { id: 'vidrift', label: 'VidRift (Embed Provider)' },
                        { id: 'vidnest', label: 'Vidnest (Embed Provider)' },
                      ].map((srv) => (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => {
                            onSelectProvider(srv.id);
                            setActiveModal(null);
                          }}
                          className={`w-full px-3 py-1.5 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            provider === srv.id
                              ? 'bg-white/20 text-white font-semibold'
                              : 'hover:bg-white/10 text-white/70'
                          }`}
                        >
                          <span>{srv.label}</span>
                          {provider === srv.id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audio & Subtitles Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveModal(activeModal === 'subtitles' ? null : 'subtitles')}
              className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${
                activeModal === 'subtitles' || selectedSubtitle
                  ? 'bg-white/20 text-white'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <CCIcon className="w-4 h-4 text-white" />
              <span className="font-semibold">Audio & Subtitles</span>
            </button>

            {/* Audio & Subtitles Floating Panel */}
            {activeModal === 'subtitles' && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#121212]/95 border border-white/15 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden z-50 p-3 text-white animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 px-1">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                    Subtitles ({subtitles.length} Languages)
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtitle Search Input for 41 languages */}
                {subtitles.length > 8 && (
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={subtitleSearch}
                      onChange={(e) => setSubtitleSearch(e.target.value)}
                      placeholder="Search language..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/30"
                    />
                  </div>
                )}

                {/* Subtitle Track Options */}
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                  {/* Off Option */}
                  <button
                    type="button"
                    onClick={() => handleSelectSubtitle(null)}
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      !selectedSubtitle
                        ? 'bg-white text-black font-bold shadow-md'
                        : 'hover:bg-white/10 text-white/80 font-medium'
                    }`}
                  >
                    <span>Off</span>
                    {!selectedSubtitle && <Check className="w-4 h-4 stroke-[2.5]" />}
                  </button>

                  {/* List of Subtitle Tracks */}
                  {filteredSubtitles.map((sub, idx) => {
                    const isSelected = selectedSubtitle === sub.lang || selectedSubtitle === sub.language;
                    return (
                      <button
                        key={`sub-${sub.lang}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSubtitle(sub)}
                        className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white text-black font-bold shadow-md'
                            : 'hover:bg-white/10 text-white/80 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{sub.language || sub.lang}</span>
                          <span className="text-[10px] uppercase opacity-50">({sub.lang})</span>
                        </span>
                        {isSelected && <Check className="w-4 h-4 stroke-[2.5]" />}
                      </button>
                    );
                  })}

                  {filteredSubtitles.length === 0 && (
                    <div className="text-center py-4 text-xs text-white/40">
                      No matching language found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Next Episode Button */}
          {type === 'tv' && (
            <button
              type="button"
              disabled={!hasNextEpisode || !onNextEpisode}
              onClick={onNextEpisode}
              className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                hasNextEpisode && onNextEpisode
                  ? 'text-white/85 hover:text-white hover:bg-white/10'
                  : 'text-white/30 cursor-not-allowed'
              }`}
              title={hasNextEpisode ? 'Play Next Episode' : 'No Next Episode'}
            >
              <SkipForward className="w-4 h-4 text-white" />
              <span>Next Episode</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. FLOATING BOTTOM OVERLAY (Timeline + Bottom Control Row, matching Image 1) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 pt-16 pb-6 px-6 md:px-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 pointer-events-none ${
          isControlsVisible || !isPlaying || activeModal
            ? 'opacity-100'
            : 'opacity-0'
        }`}
      >
        <div className="flex flex-col gap-2 pointer-events-auto w-full">
          {/* Above Timeline Row: Direct | Embed Switcher (Matching Image 1) */}
          <div className="w-full flex justify-end items-center">
            {onSelectProvider && (
              <div className="flex items-center bg-black/60 border border-white/20 backdrop-blur-md rounded-xl p-0.5 text-xs shadow-lg">
                <button
                  type="button"
                  onClick={() => onSelectProvider('miyoro')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    provider === 'miyoro'
                      ? 'bg-white text-black shadow'
                      : 'text-white/70 hover:text-white'
                  }`}
                  title="Direct Native Playback"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Direct</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectProvider('vidly')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    provider !== 'miyoro'
                      ? 'bg-white text-black font-semibold shadow'
                      : 'text-white/70 hover:text-white'
                  }`}
                  title="Embed Streaming Server"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
                  </svg>
                  <span>Embed</span>
                </button>
              </div>
            )}
          </div>

          {/* Full-Width Thin Interactive Timeline */}
          <div
            onClick={handleTimelineClick}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            className="group/timeline relative w-full h-4 flex items-center cursor-pointer"
          >
            {/* Background Track */}
            <div className="relative w-full h-1 group-hover/timeline:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all duration-150">
              {/* Buffered Range */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all duration-200"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Played Progress */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Scrubber Thumb Knob */}
            <div
              className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] -translate-x-1/2 scale-0 group-hover/timeline:scale-100 transition-transform pointer-events-none"
              style={{ left: `${progressPercent}%` }}
            />

            {/* Hover Tooltip Timestamp */}
            {hoverPosition !== null && duration > 0 && (
              <div
                className="absolute bottom-6 -translate-x-1/2 px-2.5 py-1 bg-[#141414]/95 border border-white/20 text-white text-[11px] font-bold rounded-lg shadow-2xl pointer-events-none whitespace-nowrap"
                style={{ left: `${hoverPosition * 100}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Right-aligned Remaining Duration (22:13) under Timeline (Matching Image 1) */}
          <div className="w-full flex justify-end pr-0.5 -mt-1">
            <span className="text-sm font-bold text-white tracking-wide drop-shadow">
              {remainingTimeStr}
            </span>
          </div>

          {/* 6. BOTTOM CONTROL ROW: Left Play/Skip/Vol | Center Episodes | Right Settings/Fullscreen */}
          <div className="flex items-center justify-between pt-1">
            {/* Left Controls: Play/Pause, Rewind 10, Forward 10, Volume */}
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className="text-white hover:text-white/80 transition-colors cursor-pointer focus:outline-none"
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-white text-white" />
                ) : (
                  <Play className="w-6 h-6 fill-white text-white" />
                )}
              </button>

              {/* Rewind 10s */}
              <button
                type="button"
                onClick={() => seekRelative(-10)}
                className="text-white hover:text-white/80 transition-colors cursor-pointer focus:outline-none"
                title="Rewind 10 seconds"
                aria-label="Rewind 10 seconds"
              >
                <Rewind10Icon className="w-6 h-6 text-white" />
              </button>

              {/* Forward 10s */}
              <button
                type="button"
                onClick={() => seekRelative(10)}
                className="text-white hover:text-white/80 transition-colors cursor-pointer focus:outline-none"
                title="Forward 10 seconds"
                aria-label="Forward 10 seconds"
              >
                <Forward10Icon className="w-6 h-6 text-white" />
              </button>

              {/* Volume & Inline Slider */}
              <div className="group/vol flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => {
                    if (playerRef.current) {
                      const nextMuted = !isMuted;
                      playerRef.current.muted = nextMuted;
                      setIsMuted(nextMuted);
                      setVideoMutedPreference(nextMuted);
                    }
                  }}
                  className="text-white hover:text-white/80 transition-colors cursor-pointer focus:outline-none"
                  title={isMuted ? 'Unmute' : 'Mute'}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-6 h-6 text-white" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-6 h-6 text-white" />
                  ) : (
                    <Volume2 className="w-6 h-6 text-white" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (playerRef.current) {
                      playerRef.current.volume = val;
                      if (val > 0 && isMuted) {
                        playerRef.current.muted = false;
                        setIsMuted(false);
                        setVideoMutedPreference(false);
                      }
                    }
                  }}
                  className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 h-1 bg-white/20 rounded-full accent-white cursor-pointer transition-all duration-200 overflow-hidden"
                  aria-label="Volume Slider"
                />
              </div>
            </div>

            {/* Center: Episodes ^ Button (Matching Image 1) */}
            {type === 'tv' && onOpenEpisodes && (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={onOpenEpisodes}
                  className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-semibold tracking-wide transition-all cursor-pointer hover:scale-105"
                  title="Open Episodes"
                >
                  <span>Episodes</span>
                  <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            )}

            {/* Right Controls: Settings & Fullscreen */}
            <div className="relative flex items-center gap-4 sm:gap-6">
              {/* Settings Gear Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveModal(activeModal === 'settings' ? null : 'settings')}
                  className={`text-white hover:text-white/80 transition-colors cursor-pointer focus:outline-none ${
                    activeModal === 'settings' ? 'text-white scale-110' : 'text-white/90'
                  }`}
                  title="Playback Settings"
                  aria-label="Settings"
                >
                  <Settings className="w-6 h-6" />
                </button>

                {/* Settings Floating Modal (Speed, etc.) */}
                {activeModal === 'settings' && (
                  <div className="absolute right-0 bottom-full mb-3 w-64 bg-[#121212]/95 border border-white/15 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden z-50 p-3 text-white animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 px-1">
                      <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Playback Speed</span>
                      <button
                        type="button"
                        onClick={() => setActiveModal(null)}
                        className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleSelectRate(rate)}
                          className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            playbackRate === rate
                              ? 'bg-white text-black font-bold shadow-md'
                              : 'hover:bg-white/10 text-white/80 font-medium'
                          }`}
                        >
                          <span>{rate === 1 ? 'Normal (1x)' : `${rate}x`}</span>
                          {playbackRate === rate && <Check className="w-4 h-4 stroke-[2.5]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="text-white hover:text-white/80 transition-colors cursor-pointer focus:outline-none"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="w-6 h-6 stroke-[2]" />
                ) : (
                  <Maximize className="w-6 h-6 stroke-[2]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
