import React, { useEffect, useState, useRef } from 'react';
import { fetchTrailer, IMAGE_BASE_URL, IMAGE_BASE_URL_W500 } from '../api/tmdb';
import { Volume2, VolumeX } from 'lucide-react';

interface WatchPlayerProps {
  item: any;
  type: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  seasonData?: any;
}

export default function WatchPlayer({ item, type, seasonNumber, episodeNumber, seasonData }: WatchPlayerProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine the best backdrop to show while loading
  let backdropPath = item?.backdrop_path;
  
  // If TV, try to show the episode still as the backdrop
  if (type === 'tv' && seasonData && episodeNumber) {
    const episode = seasonData.episodes?.find((e: any) => e.episode_number === episodeNumber);
    if (episode?.still_path) {
      backdropPath = episode.still_path;
    }
  }

  useEffect(() => {
    let isMounted = true;
    setIsVideoReady(false);
    setShowVideo(false);
    setTrailerKey(null);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const loadVideo = async () => {
      // Use existing fetchTrailer mechanism (fetches main trailer)
      // Since TMDB trailer discovery for specific episodes is spotty, 
      // we fallback to the main show trailer for the cinematic effect.
      const key = await fetchTrailer(item.id, type);
      
      if (isMounted && key) {
        setTrailerKey(key);
      }
    };

    loadVideo();

    return () => {
      isMounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, type, episodeNumber, seasonNumber]);

  useEffect(() => {
    // When a new video starts loading (iframe unmounts/remounts), handle the transition
    if (trailerKey) {
      setIsVideoReady(false);
      setShowVideo(false);
    }
  }, [trailerKey]);

  // Handle iframe load
  const handleIframeLoad = () => {
    // Iframe has loaded the document, but YouTube player might not be fully "playing" yet.
    // Give it a brief moment to buffer behind the image.
    setIsVideoReady(true);
    
    timerRef.current = setTimeout(() => {
      setShowVideo(true);
    }, 1500); // 1.5s delay before crossfading to hide YouTube buffering UI
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (iframeRef.current && iframeRef.current.contentWindow) {
      // Send postMessage to YouTube iframe API
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: isMuted ? 'unMute' : 'mute',
          args: []
        }),
        '*'
      );
    }
  };

  return (
    <div className="relative w-full aspect-video md:aspect-[21/9] lg:aspect-[21/9] xl:aspect-[24/9] bg-black overflow-hidden group">
      
      {/* Fallback / Loading Image */}
      <div 
        className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out z-10 
          ${showVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {backdropPath ? (
          <>
            <img 
              src={`${IMAGE_BASE_URL}${backdropPath}`} 
              alt="Backdrop" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
          </>
        ) : (
          <div className="w-full h-full bg-[#111] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-white/10 border-t-white/40 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Video Player */}
      {trailerKey && (
        <div className={`absolute inset-0 w-full h-full scale-[1.35] md:scale-[1.1] transition-opacity duration-1000 ease-in-out z-0
          ${showVideo ? 'opacity-100' : 'opacity-0'}
        `}>
          <iframe
            ref={iframeRef}
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&origin=${window.location.origin}&widgetid=1`}
            allow="autoplay; encrypted-media"
            className="w-full h-full pointer-events-none"
            onLoad={handleIframeLoad}
            tabIndex={-1}
          />
        </div>
      )}

      {/* Vignette Overlay to blend edges into page */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-transparent to-black/30 pointer-events-none z-20"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b] via-transparent to-[#0b0b0b] opacity-80 pointer-events-none z-20"></div>

      {/* Controls */}
      {trailerKey && showVideo && (
        <div className="absolute bottom-6 right-6 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            onClick={toggleMute}
            className="w-12 h-12 rounded-full border border-white/30 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      )}
    </div>
  );
}
