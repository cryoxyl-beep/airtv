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
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  ChevronLeft,
  ListVideo,
  RefreshCw,
  Check,
  FastForward,
  Subtitles,
} from 'lucide-react';
import { MovySource, MovySubtitle } from '../api/movy';
import { getVideoMutedPreference, setVideoMutedPreference } from '../utils/preferences';
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
  // Decode any XML entities first (Shaka sometimes leaves &amp; in URLs)
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
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [isChangingSource, setIsChangingSource] = useState<boolean>(false);

  // Subtitle state: auto-detect English if present
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(() => {
    if (!subtitles || subtitles.length === 0) return null;
    const eng = subtitles.find(
      (s) => s.lang?.toLowerCase().startsWith('en') || s.language?.toLowerCase().includes('english')
    );
    return eng ? (eng.lang || eng.language) : null;
  });

  // UI state
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [activeMenuTab, setActiveMenuTab] = useState<'main' | 'quality' | 'speed' | 'subtitles'>('main');
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | 'forward' | 'rewind' | null>(null);

  // Timeline scrub state
  const [isDraggingSeek, setIsDraggingSeek] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);

  // Refs for progress tracking and timeouts
  const controlsTimeoutRef = useRef<number | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const savedResumeTimeRef = useRef<number>(initialTime);
  const resumedRef = useRef<boolean>(false);
  const flashTimeoutRef = useRef<number | null>(null);

  // Validate active source
  const safeSourceIndex = Math.min(Math.max(0, currentSourceIndex), Math.max(0, sources.length - 1));
  const activeSource: MovySource | undefined = sources[safeSourceIndex] || sources[0];

  const proxyUrl = activeSource?.url ? proxyWrap(activeSource.url) : '';
  const sourceType = activeSource?.format === 'hls'
    ? 'application/x-mpegurl'
    : activeSource?.format === 'dash'
      ? 'application/dash+xml'
      : 'video/mp4';

  // Trigger flash icon feedback on central action
  const triggerFlash = (icon: 'play' | 'pause' | 'forward' | 'rewind') => {
    setFlashIcon(icon);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlashIcon(null), 600);
  };

  // Autohide controls on inactivity
  const showControlsTemporarily = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying && !showSettings && !isDraggingSeek) {
        setIsControlsVisible(false);
      }
    }, 3200);
  }, [isPlaying, showSettings, isDraggingSeek]);

  const handleMouseMove = () => {
    showControlsTemporarily();
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playerRef.current.paused) {
      playerRef.current.play().catch(() => {});
      triggerFlash('play');
    } else {
      playerRef.current.pause();
      triggerFlash('pause');
    }
    showControlsTemporarily();
  };

  // Seek relative
  const seekRelative = (deltaSeconds: number) => {
    if (!playerRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    playerRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    triggerFlash(deltaSeconds > 0 ? 'forward' : 'rewind');
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
      // Ignore if typing in input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

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
          showControlsTemporarily();
          break;
        case 'arrowdown':
          e.preventDefault();
          if (playerRef.current) {
            const newVol = Math.max(0, volume - 0.1);
            playerRef.current.volume = newVol;
            setVolume(newVol);
          }
          showControlsTemporarily();
          break;
        case 'm':
          e.preventDefault();
          if (playerRef.current) {
            const nextMuted = !isMuted;
            playerRef.current.muted = nextMuted;
            setIsMuted(nextMuted);
            setVideoMutedPreference(nextMuted);
          }
          showControlsTemporarily();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isMuted, isPlaying, duration, currentTime]);

  // Handle source switching with position preservation across formats
  const handleSelectQuality = (index: number) => {
    if (index === safeSourceIndex) {
      setShowSettings(false);
      return;
    }
    const curTime = playerRef.current?.currentTime || currentTime;
    savedResumeTimeRef.current = curTime;
    setIsChangingSource(true);
    setCurrentSourceIndex(index);
    setShowSettings(false);
  };

  // Provider configuration with CDN URL rewrite request filters (60s minimum timeout for Movy CDN manifest throttling)
  const handleProviderChange = (provider: any) => {
    if (!provider) return;

    if ((provider as any).video) {
      (provider as any).video.crossOrigin = 'anonymous';
    }

    if (isHLSProvider(provider)) {
      (provider as any).config = {
        // Movy's variant playlists can be huge (700KB-1.5MB). Allow generous timeouts.
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
        // Use our custom loader that wraps movy URLs through /api/stream
        loader: ProxyHlsLoader as any,
      };
    }

    if (isDASHProvider(provider)) {
      // dash.js config — DIFFERENT from Shaka. No retryParameters,
      // no manifest.retryParameters. The path-based proxy handles everything.
      provider.config = {
        streaming: {},
      };
    }
  };

  // CanPlay: Resume previous playback position and trigger autoplay (muted)
  const handleCanPlay = () => {
    setIsBuffering(false);
    setIsChangingSource(false);

    // Initial resume or format-change resume
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

    // Autoplay (will succeed because muted=true)
    if (playerRef.current) {
      playerRef.current.muted = true;
      playerRef.current.play().catch((err) => {
        console.warn('Autoplay waiting for user interaction or blocked:', err);
      });
    }
  };

  // Immediate autoplay trigger when source changes
  useEffect(() => {
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

    // Check existing tracks to prevent duplicate appends
    const existingTracks = Array.from(video.querySelectorAll('track'));
    const existingUrls = new Set(existingTracks.map((t) => t.src));

    subtitles.forEach((sub) => {
      if (!existingUrls.has(sub.url)) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = sub.language || sub.lang;
        track.srclang = sub.lang;
        track.src = sub.url; // already proxied through /api/stream
        if (selectedSubtitle && (sub.lang === selectedSubtitle || sub.language === selectedSubtitle)) {
          track.default = true;
        }
        video.appendChild(track);
      }
    });

    // Synchronize mode on HTML video textTracks
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

    // Update HTML video element text tracks
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

    // Update Vidstack TextTracks API
    if (playerRef.current?.textTracks) {
      for (const track of playerRef.current.textTracks) {
        if (code && (track.language === sub?.lang || track.label === sub?.language || track.label === sub?.lang)) {
          track.mode = 'showing';
        } else {
          track.mode = 'disabled';
        }
      }
    }

    setShowSettings(false);
  };

  // Periodic time updates
  const handleTimeUpdate = (detail: MediaTimeUpdateEventDetail) => {
    const cur = detail.currentTime;
    setCurrentTime(cur);

    const dur = playerRef.current?.duration || duration;
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
    }

    // Buffered range
    if (playerRef.current?.state?.bufferedEnd) {
      setBufferedEnd(playerRef.current.state.bufferedEnd);
    }

    // Save watch progress every 2 seconds
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

  // Playback rate
  const handleSelectRate = (rate: number) => {
    if (playerRef.current) {
      playerRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSettings(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying && !showSettings) {
          setIsControlsVisible(false);
        }
      }}
      className="relative w-full h-full bg-black select-none overflow-hidden font-sans group/player cursor-default"
    >
      {/* Vidstack Headless Media Player with format-aware source */}
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
            setIsBuffering(false);
            showControlsTemporarily();
          }}
          onPause={() => {
            setIsPlaying(false);
            setIsControlsVisible(true);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (onEnded) onEnded();
          }}
          onError={(err) => {
            console.error('Vidstack player playback error:', err);
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

      {/* Central Tap / Double-Tap Gesture Surface */}
      <div
        onClick={(e) => {
          // Only handle click if target is background surface, not child buttons
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
        {/* Buffering Indicator */}
        {(isBuffering || isChangingSource) && (
          <div className="flex flex-col items-center gap-3 bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in duration-200">
            <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-xs font-semibold text-white/80 tracking-wide">
              {isChangingSource ? `Loading ${activeSource?.quality || 'Quality'}...` : 'Buffering...'}
            </span>
          </div>
        )}

        {/* Central Action Flash Feedback */}
        {flashIcon && !isBuffering && (
          <div className="w-20 h-20 rounded-full bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl animate-out fade-out zoom-out-95 duration-500 pointer-events-none">
            {flashIcon === 'play' && <Play className="w-9 h-9 fill-current ml-1" />}
            {flashIcon === 'pause' && <Pause className="w-9 h-9 fill-current" />}
            {flashIcon === 'forward' && (
              <div className="flex flex-col items-center">
                <RotateCw className="w-7 h-7" />
                <span className="text-[10px] font-bold mt-0.5">+10s</span>
              </div>
            )}
            {flashIcon === 'rewind' && (
              <div className="flex flex-col items-center">
                <RotateCcw className="w-7 h-7" />
                <span className="text-[10px] font-bold mt-0.5">-10s</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* TOP HEADER CONTROLS (Back button, Media title, Server/Episodes) */}
      {/* ============================================================== */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3 sm:gap-4 max-w-[60%]">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex flex-col truncate">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-white truncate drop-shadow-md">
              {title}
            </h1>
            {type === 'tv' && (
              <p className="text-xs text-white/60 truncate font-medium">
                Season {season || 1} • Episode {episode || 1}
                {episodeTitle ? `: ${episodeTitle}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Right: Embedded Server Selector & Episode Overlay trigger */}
        <div className="flex items-center gap-2.5">
          {serverSelector}

          {type === 'tv' && onOpenEpisodes && (
            <button
              type="button"
              onClick={onOpenEpisodes}
              className="w-10 h-10 rounded-full bg-[#141414]/90 hover:bg-[#1c1c1c]/95 border border-white/10 shadow-lg backdrop-blur-md flex items-center justify-center text-white transition-all cursor-pointer"
              title="Episodes"
              aria-label="Episodes"
            >
              <ListVideo className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* BOTTOM CONTROLS BAR (Scrubber, Playback, Audio, Settings)       */}
      {/* ============================================================== */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 pt-16 pb-4 sm:pb-6 px-4 sm:px-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2 transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Scrubbing Timeline */}
        <div
          onClick={handleTimelineClick}
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
          className="relative w-full h-5 flex items-center cursor-pointer group/slider py-2"
        >
          {/* Base track */}
          <div className="relative w-full h-1 group-hover/slider:h-2 bg-white/20 rounded-full overflow-hidden transition-all duration-200">
            {/* Buffer progress */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, bufferedPercent))}%` }}
            />
            {/* Played progress */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-white rounded-full transition-all duration-75"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>

          {/* Scrubber thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover/slider:scale-100 transition-transform duration-150 pointer-events-none"
            style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />

          {/* Hover time tooltip */}
          {hoverPosition !== null && duration > 0 && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-[#181818] border border-white/20 text-white text-[11px] font-semibold tracking-wide shadow-xl pointer-events-none"
              style={{ left: `${hoverPosition * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white pt-1">
          {/* Left Buttons: Play, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-white"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Rewind 10s */}
            <button
              type="button"
              onClick={() => seekRelative(-10)}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Rewind 10s"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={() => seekRelative(10)}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Forward 10s"
              aria-label="Forward 10 seconds"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume">
              <button
                type="button"
                onClick={() => {
                  if (playerRef.current) {
                    const next = !isMuted;
                    playerRef.current.muted = next;
                    setIsMuted(next);
                    setVideoMutedPreference(next);
                  }
                }}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
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
                className="w-16 sm:w-20 h-1 bg-white/20 rounded-full accent-white cursor-pointer opacity-70 group-hover/volume:opacity-100 transition-opacity"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-xs sm:text-sm font-semibold text-white/80 tracking-wide ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40 mx-1.5">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Buttons: Next Ep, Settings (Quality & Speed), Fullscreen */}
          <div className="relative flex items-center gap-2 sm:gap-3">
            {/* Next Episode Button */}
            {type === 'tv' && hasNextEpisode && onNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Next Episode"
              >
                <FastForward className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">Next Episode</span>
              </button>
            )}

            {/* Subtitles Button (Up to 41 languages from /api/play) */}
            {subtitles && subtitles.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveMenuTab('subtitles');
                  setShowSettings(!showSettings || activeMenuTab !== 'subtitles');
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedSubtitle
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80 hover:text-white'
                }`}
                title="Subtitles / Captions"
                aria-label="Subtitles"
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span className="max-w-[70px] sm:max-w-[110px] truncate">
                  {selectedSubtitle
                    ? (subtitles.find((s) => s.lang === selectedSubtitle || s.language === selectedSubtitle)?.language || selectedSubtitle)
                    : 'CC'}
                </span>
              </button>
            )}

            {/* Quality Pill Button (Current Quality) */}
            {sources.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveMenuTab('quality');
                  setShowSettings(!showSettings || activeMenuTab !== 'quality');
                }}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer"
                title="Quality"
              >
                <span>{activeSource?.quality || 'Auto'}</span>
              </button>
            )}

            {/* Settings Menu Button */}
            <button
              type="button"
              onClick={() => {
                setActiveMenuTab('main');
                setShowSettings(!showSettings);
              }}
              className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                showSettings ? 'bg-white text-black' : 'hover:bg-white/10 text-white/80 hover:text-white'
              }`}
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>

            {/* Settings & Quality Popup Modal */}
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-3 w-56 sm:w-64 bg-[#141414]/95 border border-white/15 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden z-50 text-white text-xs sm:text-sm animate-in fade-in zoom-in-95 duration-150">
                {activeMenuTab === 'main' && (
                  <div className="p-2 flex flex-col gap-1">
                    {subtitles && subtitles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveMenuTab('subtitles')}
                        className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <span className="font-medium text-white/80 flex items-center gap-2">
                          <Subtitles className="w-4 h-4 text-white/60" />
                          <span>Subtitles</span>
                        </span>
                        <span className="text-white font-bold max-w-[100px] truncate">
                          {selectedSubtitle
                            ? (subtitles.find((s) => s.lang === selectedSubtitle || s.language === selectedSubtitle)?.language || selectedSubtitle)
                            : 'Off'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveMenuTab('quality')}
                      className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 flex items-center justify-between text-left transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-white/80">Quality</span>
                      <span className="text-white font-bold">{activeSource?.quality || 'Auto'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMenuTab('speed')}
                      className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 flex items-center justify-between text-left transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-white/80">Playback Speed</span>
                      <span className="text-white font-bold">{playbackRate}x</span>
                    </button>
                  </div>
                )}

                {activeMenuTab === 'quality' && (
                  <div className="p-2 flex flex-col gap-1 max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wider border-b border-white/10 flex items-center justify-between">
                      <span>Select Stream Quality</span>
                      <button
                        type="button"
                        onClick={() => setActiveMenuTab('main')}
                        className="text-white/60 hover:text-white"
                      >
                        Back
                      </button>
                    </div>
                    {sources.map((src, idx) => (
                      <button
                        key={`${src.quality}-${idx}`}
                        type="button"
                        onClick={() => handleSelectQuality(idx)}
                        className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
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
                )}

                {activeMenuTab === 'speed' && (
                  <div className="p-2 flex flex-col gap-1">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wider border-b border-white/10 flex items-center justify-between">
                      <span>Playback Speed</span>
                      <button
                        type="button"
                        onClick={() => setActiveMenuTab('main')}
                        className="text-white/60 hover:text-white"
                      >
                        Back
                      </button>
                    </div>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleSelectRate(rate)}
                        className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
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
                )}

                {activeMenuTab === 'subtitles' && (
                  <div className="p-2 flex flex-col gap-1 max-h-72 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wider border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#141414] z-10">
                      <span>Subtitles ({subtitles.length})</span>
                      <button
                        type="button"
                        onClick={() => setActiveMenuTab('main')}
                        className="text-white/60 hover:text-white cursor-pointer"
                      >
                        Back
                      </button>
                    </div>

                    {/* Turn Off Subtitles */}
                    <button
                      type="button"
                      onClick={() => handleSelectSubtitle(null)}
                      className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                        !selectedSubtitle
                          ? 'bg-white text-black font-bold shadow-md'
                          : 'hover:bg-white/10 text-white/80 font-medium'
                      }`}
                    >
                      <span>Off</span>
                      {!selectedSubtitle && <Check className="w-4 h-4 stroke-[2.5]" />}
                    </button>

                    {/* All 41 available subtitle languages from /api/play */}
                    {subtitles.map((sub, idx) => {
                      const isSelected =
                        selectedSubtitle === sub.lang || selectedSubtitle === sub.language;
                      return (
                        <button
                          key={`sub-opt-${sub.lang}-${idx}`}
                          type="button"
                          onClick={() => handleSelectSubtitle(sub)}
                          className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-white text-black font-bold shadow-md'
                              : 'hover:bg-white/10 text-white/80 font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{sub.language || sub.lang}</span>
                            <span className="text-[10px] uppercase opacity-60">({sub.lang})</span>
                          </span>
                          {isSelected && <Check className="w-4 h-4 stroke-[2.5]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
