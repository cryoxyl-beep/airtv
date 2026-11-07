import React, { useRef, useState, useEffect } from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { MediaPlayer, MediaProvider, Track, MediaPlayerInstance, MediaTimeUpdateEventDetail } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import { AnimeStreamResult } from '../api/anivault';
import { getVideoMutedPreference } from '../utils/preferences';
import { FastForward } from 'lucide-react';
import MiyoroLoader from './MiyoroLoader';

interface AnimeVidstackPlayerProps {
  stream: AnimeStreamResult;
  title: string;
  poster?: string;
  initialTime?: number;
  onProgress?: (currentTime: number, duration: number, progress: number) => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
}

export default function AnimeVidstackPlayer({
  stream,
  title,
  poster,
  initialTime = 0,
  onProgress,
  onEnded,
  onError,
}: AnimeVidstackPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const resumedRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<number>(0);

  // Loading and buffering state for MiyoroLoader
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [showBufferingOverlay, setShowBufferingOverlay] = useState<boolean>(false);

  // Reset resumed flag and loading state when stream URL changes (e.g., episode or server change)
  useEffect(() => {
    setIsStreamLoading(true);
    setIsBuffering(false);
    setShowBufferingOverlay(false);
    resumedRef.current = false;
    if (playerRef.current) {
      playerRef.current.muted = true;
      playerRef.current.play().catch(() => {});
    }
  }, [stream.hlsProxyUrl]);

  // 300ms debounce for playback buffering overlay so tiny stalls don't flicker
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isBuffering && !isStreamLoading) {
      timer = setTimeout(() => {
        setShowBufferingOverlay(true);
      }, 300);
    } else {
      setShowBufferingOverlay(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isBuffering, isStreamLoading]);

  // Handle resume playback on canPlay and ensure autoplay
  const handleCanPlay = () => {
    if (!resumedRef.current && initialTime > 5 && playerRef.current) {
      try {
        playerRef.current.currentTime = initialTime;
        resumedRef.current = true;
      } catch (err) {
        console.warn('Failed to seek to initial resume time:', err);
      }
    }
    // Attempt play immediately (works reliably because muted=true)
    playerRef.current?.play().catch(() => {});
  };

  const handleTimeUpdate = (detail: MediaTimeUpdateEventDetail) => {
    const cur = detail.currentTime;
    setCurrentTime(cur);

    const dur = playerRef.current?.duration || duration;
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
    }

    // Save watch progress at 2-second intervals
    if (onProgress && dur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 2) {
      lastSavedTimeRef.current = cur;
      const progress = Math.min(1, Math.max(0, cur / dur));
      onProgress(cur, dur, progress);
    }
  };

  const isIntroActive =
    stream.intro &&
    currentTime >= stream.intro.start &&
    currentTime <= stream.intro.end;

  const isOutroActive =
    stream.outro &&
    currentTime >= stream.outro.start &&
    currentTime <= stream.outro.end;

  const handleSkipIntro = () => {
    if (stream.intro && playerRef.current) {
      playerRef.current.currentTime = stream.intro.end + 0.5;
    }
  };

  const handleSkipOutro = () => {
    if (stream.outro && playerRef.current) {
      playerRef.current.currentTime = stream.outro.end + 0.5;
    }
  };

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center">
      <MediaPlayer
        ref={playerRef}
        key={stream.hlsProxyUrl}
        title={title}
        src={{ src: stream.hlsProxyUrl, type: 'application/x-mpegurl' }}
        poster={poster}
        crossOrigin="anonymous"
        autoPlay
        playsInline
        muted={true}
        onCanPlay={handleCanPlay}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsStreamLoading(false);
          setIsBuffering(false);
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        onError={(err) => {
          setIsStreamLoading(false);
          setIsBuffering(false);
          if (onError) onError(err);
        }}
        className="w-full h-full"
      >
        <MediaProvider>
          {stream.englishSubtitleUrl && (
            <Track
              src={stream.englishSubtitleUrl}
              kind="subtitles"
              label="English"
              lang="en-US"
              type="vtt"
              default
            />
          )}
        </MediaProvider>

        <DefaultVideoLayout icons={defaultLayoutIcons} />

        {/* Stream initial loading or episode/server change: solid black background */}
        {isStreamLoading && (
          <div className="absolute inset-0 z-30 bg-black flex items-center justify-center">
            <MiyoroLoader size={80} color="#ffffff" />
          </div>
        )}

        {/* Video buffering during playback: semi-transparent ~40% after 300ms delay, pointer-events-none */}
        {showBufferingOverlay && !isStreamLoading && (
          <div className="absolute inset-0 z-30 bg-black/40 flex items-center justify-center pointer-events-none">
            <MiyoroLoader size={80} color="#ffffff" />
          </div>
        )}

        {/* Skip Intro Overlay Button */}
        {isIntroActive && (
          <button
            onClick={handleSkipIntro}
            className="absolute bottom-20 right-6 z-40 bg-black/75 hover:bg-black/90 text-white font-medium text-xs md:text-sm px-4 py-2.5 rounded-full border border-white/20 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer animate-in fade-in duration-200"
          >
            <FastForward className="w-4 h-4 text-white" />
            <span>Skip Intro</span>
          </button>
        )}

        {/* Skip Outro Overlay Button */}
        {isOutroActive && (
          <button
            onClick={handleSkipOutro}
            className="absolute bottom-20 right-6 z-40 bg-black/75 hover:bg-black/90 text-white font-medium text-xs md:text-sm px-4 py-2.5 rounded-full border border-white/20 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer animate-in fade-in duration-200"
          >
            <FastForward className="w-4 h-4 text-white" />
            <span>Skip Outro</span>
          </button>
        )}
      </MediaPlayer>
    </div>
  );
}
