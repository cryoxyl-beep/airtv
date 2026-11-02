import React, { useEffect, useRef } from 'react';
import { IMAGE_BASE_URL } from '../api/tmdb';
import { Play, X } from 'lucide-react';

interface MoreEpisodesPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'tv' | 'anime';
  title: string;
  backdropPath?: string;
  seasons?: any[];
  selectedSeason: number;
  activePlayingSeason: number;
  currentEpisode: number;
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
  backdropPath,
  seasons = [],
  selectedSeason,
  activePlayingSeason,
  currentEpisode,
  episodes = [],
  loadingEpisodes = false,
  onSeasonChange,
  onEpisodeSelect,
}: MoreEpisodesPopoverProps) {
  const episodeListRef = useRef<HTMLDivElement>(null);
  const seasonListRef = useRef<HTMLDivElement>(null);
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null);
  const activeSeasonRef = useRef<HTMLButtonElement | null>(null);

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

  // Position current episode at the TOP of the visible scroll container when opened or when episodes finish loading
  useEffect(() => {
    if (!isOpen || episodes.length === 0) return;

    const alignCurrentEpisodeToTop = () => {
      const container = episodeListRef.current;
      const targetEl = activeEpisodeRef.current;

      if (container) {
        const shouldScrollToCurrent =
          type === 'anime' || selectedSeason === activePlayingSeason;

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
  }, [isOpen, loadingEpisodes, episodes, selectedSeason, activePlayingSeason, currentEpisode, type]);

  if (!isOpen) return null;

  const validSeasons = seasons.filter((s: any) => s.season_number > 0);
  const fallbackThumb = backdropPath
    ? backdropPath.startsWith('http')
      ? backdropPath
      : `${IMAGE_BASE_URL}${backdropPath}`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="More Episodes"
    >
      <div
        className="relative w-full max-w-5xl h-[82vh] max-h-[760px] bg-[#111111]/95 border border-white/10 rounded-2xl shadow-[0_28px_90px_rgba(0,0,0,0.92)] backdrop-blur-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-5 border-b border-white/10 shrink-0 bg-[#141414]/80">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg md:text-xl font-bold tracking-tight text-white truncate">
                {title}
              </h3>
              <span className="text-white/30">•</span>
              <span className="text-xs md:text-sm font-medium text-white/60 shrink-0">
                {type === 'anime'
                  ? `${episodes.length} Episodes`
                  : `Season ${selectedSeason} (${episodes.length} Episodes)`}
              </span>
            </div>
            <p className="text-xs text-white/45">
              {type === 'anime'
                ? `Currently on Episode ${currentEpisode}`
                : `Currently on Season ${activePlayingSeason}, Episode ${currentEpisode}`}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors shrink-0"
            aria-label="Close More Episodes"
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
              className="w-full md:w-60 lg:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-[#0d0d0d]/70 overflow-x-auto md:overflow-y-auto shrink-0 p-3 md:p-4 flex md:flex-col gap-1.5"
            >
              <div className="hidden md:block px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Seasons
              </div>
              {validSeasons.map((s: any) => {
                const isSelected = s.season_number === selectedSeason;
                return (
                  <button
                    key={s.id || s.season_number}
                    ref={isSelected ? activeSeasonRef : null}
                    onClick={() => onSeasonChange(s.season_number)}
                    className={`w-auto md:w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between gap-3 shrink-0 ${
                      isSelected
                        ? 'bg-white text-black font-semibold shadow-md'
                        : 'text-white/75 hover:bg-white/10 hover:text-white font-medium'
                    }`}
                  >
                    <span className="text-sm truncate">
                      {s.name || `Season ${s.season_number}`}
                    </span>
                    {s.episode_count ? (
                      <span
                        className={`text-xs shrink-0 ${
                          isSelected ? 'text-black/65 font-semibold' : 'text-white/40'
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
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2.5 relative"
          >
            {loadingEpisodes && episodes.length === 0 ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-24 md:h-28 w-full bg-white/5 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : episodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/50 text-sm">
                No episodes available.
              </div>
            ) : (
              <div className="space-y-2.5 pb-[55vh]">
                {episodes.map((ep: any) => {
                  const epNum = ep.episode_number;
                  const isCurrentEpisode =
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
                      className={`w-full text-left group rounded-xl p-2.5 md:p-3.5 transition-all flex items-center gap-3.5 md:gap-5 border ${
                        isCurrentEpisode
                          ? 'bg-white/[0.14] border-white/40 shadow-lg'
                          : 'bg-white/[0.03] hover:bg-white/[0.09] border-white/5 hover:border-white/15'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-32 sm:w-40 md:w-44 aspect-video rounded-lg overflow-hidden bg-[#1b1b1b] shrink-0">
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
                        <div
                          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                            isCurrentEpisode
                              ? 'bg-black/35 opacity-100'
                              : 'bg-black/40 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                        {ep.runtime ? (
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-medium text-white/90">
                            {ep.runtime}m
                          </span>
                        ) : null}
                      </div>

                      {/* Episode Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs md:text-sm font-bold text-white/55">
                            {type === 'anime' ? `Episode ${epNum}` : `${epNum}.`}
                          </span>
                          <span className="text-sm md:text-base font-semibold text-white truncate">
                            {type === 'anime' && epTitle === `Episode ${epNum}`
                              ? ''
                              : epTitle}
                          </span>
                          {isCurrentEpisode && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white text-black rounded-sm">
                              Current
                            </span>
                          )}
                        </div>

                        {ep.overview ? (
                          <p className="text-xs md:text-sm text-white/60 line-clamp-2 leading-relaxed">
                            {ep.overview}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40">
                            {type === 'anime'
                              ? `Watch Episode ${epNum}`
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
