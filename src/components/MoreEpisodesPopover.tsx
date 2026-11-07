import React, { useEffect, useState, useRef } from 'react';
import { IMAGE_BASE_URL, resolveLogo, getCachedLogo } from '../api/tmdb';
import { Play, X } from 'lucide-react';
import { SkeletonEpisodeList } from './MiyoroSkeletons';

interface MoreEpisodesPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'tv' | 'anime';
  title: string;
  item?: any;
  logoUrl?: string | null;
  backdropPath?: string;
  seasons?: any[];
  selectedSeason: number;
  activePlayingSeason: number;
  currentEpisode: number;
  hasProgress?: boolean;
  episodes: any[];
  loadingEpisodes?: boolean;
  onSeasonChange: (seasonNumber: number) => void;
  onEpisodeSelect: (episodeNumber: number, seasonNumber?: number) => void;
}

export default function MoreEpisodesPopover({
  isOpen,
  onClose,
  type,
  title,
  item,
  logoUrl: propLogoUrl,
  backdropPath,
  seasons = [],
  selectedSeason,
  activePlayingSeason,
  currentEpisode,
  hasProgress = false,
  episodes = [],
  loadingEpisodes = false,
  onSeasonChange,
  onEpisodeSelect,
}: MoreEpisodesPopoverProps) {
  const [logo, setLogo] = useState<string | null>(() => propLogoUrl || (item ? getCachedLogo(item) : null));
  const episodeListRef = useRef<HTMLDivElement>(null);
  const seasonListRef = useRef<HTMLDivElement>(null);
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null);
  const activeSeasonRef = useRef<HTMLButtonElement | null>(null);

  // Synchronize or resolve HD clear logo primarily (same as Watch Page)
  useEffect(() => {
    if (propLogoUrl) {
      setLogo(propLogoUrl);
      return;
    }
    if (!item) return;
    const cached = getCachedLogo(item);
    if (cached) setLogo(cached);
    let mounted = true;
    resolveLogo(item).then((url) => {
      if (mounted && url) {
        setLogo(url);
      }
    });
    return () => {
      mounted = false;
    };
  }, [item, propLogoUrl]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Position current episode at the TOP of the visible scroll container when opened
  // ONLY if hasProgress is true (the user actually has watching progress)
  useEffect(() => {
    if (!isOpen || episodes.length === 0) return;

    const alignCurrentEpisodeToTop = () => {
      const container = episodeListRef.current;
      const targetEl = activeEpisodeRef.current;

      if (container) {
        const shouldScrollToCurrent =
          hasProgress && (type === 'anime' || selectedSeason === activePlayingSeason);

        if (shouldScrollToCurrent && targetEl) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();
          const topPadding = parseFloat(window.getComputedStyle(container).paddingTop) || 16;
          const nextScrollTop =
            container.scrollTop + (targetRect.top - containerRect.top) - topPadding;
          container.scrollTop = Math.max(0, nextScrollTop);
        } else {
          container.scrollTop = 0;
        }
      }

      if (type === 'tv' && seasonListRef.current && activeSeasonRef.current) {
        const sContainer = seasonListRef.current;
        const sTarget = activeSeasonRef.current;
        const sContainerRect = sContainer.getBoundingClientRect();
        const sTargetRect = sTarget.getBoundingClientRect();
        sContainer.scrollTop = Math.max(
          0,
          sContainer.scrollTop + (sTargetRect.top - sContainerRect.top) - 16
        );
      }
    };

    alignCurrentEpisodeToTop();
    const rafId = requestAnimationFrame(alignCurrentEpisodeToTop);
    const timerId = setTimeout(alignCurrentEpisodeToTop, 50);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [isOpen, loadingEpisodes, episodes, selectedSeason, activePlayingSeason, currentEpisode, hasProgress, type]);

  if (!isOpen) return null;

  const validSeasons = seasons.filter((s: any) => s.season_number > 0);
  const fallbackThumb = backdropPath
    ? backdropPath.startsWith('http')
      ? backdropPath
      : `${IMAGE_BASE_URL}${backdropPath}`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Episodes"
    >
      <div
        className="relative w-full max-w-5xl h-[84vh] max-h-[780px] bg-[#0d0d0f]/95 border border-white/10 rounded-2xl md:rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.95)] backdrop-blur-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: HD Clear Logo primarily (or text fallback), with close button */}
        <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-5 border-b border-white/[0.08] shrink-0 bg-[#121214]/90 backdrop-blur-md">
          <div className="flex items-center min-w-0 pr-4 h-11 md:h-13">
            {logo ? (
              <img
                src={logo}
                alt={title}
                className="max-h-11 md:max-h-13 w-auto max-w-[260px] md:max-w-[340px] object-contain object-left drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] select-none"
                draggable={false}
                onError={() => setLogo(null)}
              />
            ) : (
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white truncate drop-shadow-md">
                {title}
              </h2>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all duration-200 shrink-0 cursor-pointer"
            aria-label="Close Episodes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Side: Season Selector (TV Series ONLY — Never shown for Anime) */}
          {type === 'tv' && validSeasons.length > 0 && (
            <div
              ref={seasonListRef}
              className="w-full md:w-60 lg:w-64 border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#0c0c0e]/80 overflow-x-auto md:overflow-y-auto shrink-0 p-3 md:p-4 flex md:flex-col gap-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
            >
              <div className="hidden md:block px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                Seasons
              </div>
              {validSeasons.map((s: any) => {
                const isSelected = s.season_number === selectedSeason;
                return (
                  <button
                    key={s.id || s.season_number}
                    ref={isSelected ? activeSeasonRef : null}
                    onClick={() => onSeasonChange(s.season_number)}
                    className={`w-auto md:w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-between gap-3 shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black font-bold shadow-[0_4px_16px_rgba(255,255,255,0.15)]'
                        : 'text-white/70 hover:bg-white/[0.07] hover:text-white font-medium'
                    }`}
                  >
                    <span className="text-sm truncate">
                      {s.name || `Season ${s.season_number}`}
                    </span>
                    {s.episode_count ? (
                      <span
                        className={`text-xs shrink-0 ${
                          isSelected ? 'text-black/60 font-semibold' : 'text-white/40'
                        }`}
                      >
                        {s.episode_count} eps
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* Right Side (or Full Width for Anime): Continuous Vertical Scrollable Episode List */}
          <div
            ref={episodeListRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
          >
            {loadingEpisodes && episodes.length === 0 ? (
              <div className="py-2">
                <SkeletonEpisodeList count={6} />
              </div>
            ) : episodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/40 text-sm">
                No episodes available.
              </div>
            ) : (
              <div className="space-y-3 pb-2">
                {episodes.map((ep: any) => {
                  const epNum = ep.episode_number;
                  // ONLY show CURRENT badge if user has actual progress and this matches current episode
                  const isCurrentEpisode =
                    Boolean(hasProgress) &&
                    epNum === currentEpisode &&
                    (type === 'anime' || selectedSeason === activePlayingSeason);

                  const rawStill = ep.still_path;
                  const thumbUrl = rawStill
                    ? rawStill.startsWith('http')
                      ? rawStill
                      : `${IMAGE_BASE_URL}${rawStill}`
                    : fallbackThumb;

                  const epTitle =
                    ep.name && !/^Episode\s+\d+$/i.test(ep.name.trim())
                      ? ep.name
                      : `Episode ${epNum}`;

                  return (
                    <button
                      key={ep.id || epNum}
                      ref={isCurrentEpisode ? activeEpisodeRef : null}
                      data-episode-number={epNum}
                      onClick={() => onEpisodeSelect(epNum, type === 'tv' ? selectedSeason : undefined)}
                      className={`w-full text-left group rounded-xl p-3 md:p-3.5 transition-all duration-200 flex items-center gap-4 md:gap-5 border cursor-pointer ${
                        isCurrentEpisode
                          ? 'bg-white/[0.10] border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
                          : 'bg-white/[0.025] hover:bg-white/[0.07] border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      {/* Thumbnail with clean triangle play icon on hover (no circular enclosure) */}
                      <div className="relative w-36 sm:w-44 md:w-48 aspect-video rounded-lg overflow-hidden bg-[#181818] border border-white/10 shrink-0">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={epTitle}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/25 text-xs">
                            Ep. {epNum}
                          </div>
                        )}

                        {/* Hover Overlay: Triangle Play icon without circular enclosure */}
                        <div className="absolute inset-0 flex items-center justify-center transition-all duration-200 bg-black/45 opacity-0 group-hover:opacity-100">
                          <Play className="w-8 h-8 md:w-9 md:h-9 text-white fill-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)] transform group-hover:scale-110 transition-transform duration-200 ml-0.5" />
                        </div>

                        {ep.runtime ? (
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-sm text-[10px] font-semibold text-white/90 border border-white/10">
                            {ep.runtime}m
                          </span>
                        ) : null}
                      </div>

                      {/* Episode Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm md:text-base font-semibold text-white group-hover:text-white transition-colors truncate">
                            {type === 'anime'
                              ? (epTitle.toLowerCase().startsWith('episode') ? epTitle : `${epNum}. ${epTitle}`)
                              : `${epNum}. ${ep.name || `Episode ${epNum}`}`}
                          </span>
                          {isCurrentEpisode && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase bg-white text-black rounded-[4px] shadow-sm">
                              CURRENT
                            </span>
                          )}
                        </div>

                        {ep.overview ? (
                          <p className="text-xs md:text-[13px] text-white/55 group-hover:text-white/75 line-clamp-2 leading-relaxed transition-colors">
                            {ep.overview}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40">
                            {type === 'anime'
                              ? `Episode ${epNum}`
                              : `Season ${selectedSeason} • Episode ${epNum}`}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
