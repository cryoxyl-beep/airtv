import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchAnimeDetails } from '../api/anilist';
import { fetchDetails, fetchTVSeason, getSeedItem } from '../api/tmdb';
import { buildAnimeEpisodeList } from '../api/animeResolver';
import { extractAnimeSeasons } from '../api/animeRelations';
import WatchPageContent from '../components/WatchPage';
import MoreEpisodesPopover from '../components/MoreEpisodesPopover';
import { ArrowLeft } from 'lucide-react';
import WatchPageSkeleton from '../components/WatchPageSkeleton';
import { getWatchProgress, saveWatchProgress } from '../utils/preferences';

interface WatchPageProps {
  type: 'movie' | 'tv' | 'anime';
}

export default function WatchPage({ type }: WatchPageProps) {
  const { id, season, episode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const initialSeed =
    (location.state as any)?.item || (id ? getSeedItem(type, parseInt(id, 10)) : null);

  const [data, setData] = useState<any>(initialSeed);

  // Resolve initial watch progress from localStorage or URL params
  const savedProgress = id ? getWatchProgress(type, id) : null;
  const urlSeason = season ? parseInt(season, 10) : undefined;
  const urlEpisode = episode ? parseInt(episode, 10) : undefined;

  const hasExplicitUrlProgress =
    (urlSeason !== undefined && urlSeason > 1) ||
    (urlEpisode !== undefined && urlEpisode > 1);

  const resolvedSeason =
    type === 'tv'
      ? hasExplicitUrlProgress
        ? urlSeason || 1
        : savedProgress?.season || urlSeason || 1
      : 1;

  const resolvedEpisode =
    type === 'movie'
      ? 1
      : hasExplicitUrlProgress
      ? urlEpisode || 1
      : savedProgress?.episode || urlEpisode || 1;

  const hasProgress = Boolean(savedProgress || hasExplicitUrlProgress);
  const progressPercent = savedProgress?.progress ?? (hasExplicitUrlProgress ? 0.35 : 0);

  const [selectedPopoverSeason, setSelectedPopoverSeason] = useState<number>(resolvedSeason);
  const [showMoreEpisodes, setShowMoreEpisodes] = useState(false);

  const [seasonData, setSeasonData] = useState<any>(() => {
    if (type === 'tv' && initialSeed?.['season/1'] && resolvedSeason === 1) {
      return initialSeed['season/1'];
    }
    return null;
  });
  const [popoverSeasonData, setPopoverSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(!initialSeed);
  const [loadingEpisodes, setLoadingEpisodes] = useState(type === 'tv' || type === 'anime');
  const [error, setError] = useState(false);

  // Sync selectedPopoverSeason when resolvedSeason changes
  useEffect(() => {
    setSelectedPopoverSeason(resolvedSeason);
  }, [resolvedSeason, id]);

  // If URL explicitly specifies progress > S1E1, persist it so Resume stays consistent
  useEffect(() => {
    if (id && hasExplicitUrlProgress) {
      saveWatchProgress(type, id, {
        season: type === 'tv' ? urlSeason || 1 : undefined,
        episode: urlEpisode || 1,
        progress: savedProgress?.progress ?? 0.35,
      });
    }
  }, [id, type, hasExplicitUrlProgress, urlSeason, urlEpisode]);

  useEffect(() => {
    let mounted = true;
    const numericId = id ? parseInt(id, 10) : 0;
    if (!numericId) {
      setError(true);
      setLoading(false);
      return;
    }

    const seed = (location.state as any)?.item || getSeedItem(type, numericId);
    if (seed) {
      if (type === 'anime' && seed.anilist_raw && !seed.animeGroup) {
        seed.animeGroup = { seasons: extractAnimeSeasons(seed.anilist_raw) };
      }
      setData(seed);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const loadContent = async () => {
      setError(false);
      setLoadingEpisodes(type === 'tv' || type === 'anime');
      let isRedirecting = false;

      try {
        if (type === 'anime') {
          const details = await fetchAnimeDetails(numericId);
          if (!mounted) return;
          if (details) {
            details.animeGroup = { seasons: extractAnimeSeasons(details.anilist_raw) };
            setData({ ...details });
            setLoading(false);

            const numEpisodes = details.number_of_episodes || 12;
            const streamEps = details.anilist_raw?.streamingEpisodes;

            // Fast provisional episodes while TVDB/Jikan resolves
            if (Array.isArray(streamEps) && streamEps.length > 0 && !seasonData) {
              setSeasonData({
                episodes: streamEps.map((se: any, idx: number) => ({
                  episode_number: idx + 1,
                  name: se.title
                    ? se.title.replace(/^Episode\s+\d+\s*-\s*/i, '')
                    : `Episode ${idx + 1}`,
                  overview: '',
                  still_path: se.thumbnail || details.backdrop_path,
                })),
              });
            }

            const mergedEpisodes = await buildAnimeEpisodeList(
              numericId,
              numEpisodes,
              streamEps,
              details.backdrop_path
            );
            if (mounted) {
              setSeasonData({ episodes: mergedEpisodes });
              setLoadingEpisodes(false);
            }
          } else if (!seed) {
            setError(true);
          }
        } else if (type === 'tv') {
          const [details, explicitSeason] = await Promise.all([
            fetchDetails(numericId, 'tv'),
            resolvedSeason !== 1
              ? fetchTVSeason(numericId, resolvedSeason).catch(() => null)
              : Promise.resolve(null),
          ]);

          if (!mounted) return;
          setData(details);
          setLoading(false);

          const seasons = details.seasons || [];
          let targetSeason = resolvedSeason;
          const seasonExists = seasons.find((s: any) => s.season_number === targetSeason);

          if (!seasonExists && seasons.length > 0) {
            const validSeason = seasons.find((s: any) => s.season_number > 0) || seasons[0];
            targetSeason = validSeason.season_number;
            isRedirecting = true;
            navigate(`/watch/tv/${id}/${targetSeason}/1`, { replace: true });
            return;
          }

          if (targetSeason === 1 && details['season/1']) {
            setSeasonData(details['season/1']);
            setPopoverSeasonData(details['season/1']);
            setLoadingEpisodes(false);
          } else if (explicitSeason) {
            setSeasonData(explicitSeason);
            setPopoverSeasonData(explicitSeason);
            setLoadingEpisodes(false);
          } else {
            try {
              const sData = await fetchTVSeason(numericId, targetSeason);
              if (mounted) {
                setSeasonData(sData);
                setPopoverSeasonData(sData);
              }
            } catch (e) {
              console.error('fetchTVSeason failed:', e);
            } finally {
              if (mounted) setLoadingEpisodes(false);
            }
          }
        } else {
          const details = await fetchDetails(numericId, 'movie');
          if (mounted) {
            setData(details);
            setLoading(false);
            setLoadingEpisodes(false);
          }
        }
      } catch (err: any) {
        console.error('Failed to load watch data:', err.message || err);
        if (mounted && !seed) {
          setError(true);
        }
      } finally {
        if (mounted && !isRedirecting) {
          setLoading(false);
          setLoadingEpisodes(false);
        }
      }
    };

    loadContent();
    return () => {
      mounted = false;
    };
  }, [id, type]);

  // Load season data for the More Episodes popover when switching seasons in TV mode
  useEffect(() => {
    if (type !== 'tv' || !id || !data) return;
    if (selectedPopoverSeason === resolvedSeason && seasonData) {
      setPopoverSeasonData(seasonData);
      return;
    }
    if (selectedPopoverSeason === 1 && data['season/1']) {
      setPopoverSeasonData(data['season/1']);
      return;
    }

    let mounted = true;
    setLoadingEpisodes(true);
    fetchTVSeason(parseInt(id, 10), selectedPopoverSeason)
      .then((res) => {
        if (mounted) {
          setPopoverSeasonData(res);
          setLoadingEpisodes(false);
        }
      })
      .catch((e) => {
        console.error('fetchTVSeason failed:', e);
        if (mounted) setLoadingEpisodes(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedPopoverSeason, resolvedSeason, id, type, data, seasonData]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black font-sans text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 p-6 z-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse" />
        </div>
        <div className="w-full relative bg-black">
          <WatchPageSkeleton type={type === 'anime' ? 'tv' : type} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <p className="text-xl">Content unavailable.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handlePrimaryPlay = () => {
    if (!id) return;
    if (type === 'movie') {
      saveWatchProgress('movie', id, { progress: 0.35 });
      navigate(`/play/movie/${id}`);
    } else if (type === 'tv') {
      saveWatchProgress('tv', id, {
        season: resolvedSeason,
        episode: resolvedEpisode,
        progress: 0.35,
      });
      navigate(`/play/tv/${id}/${resolvedSeason}/${resolvedEpisode}`);
    } else if (type === 'anime') {
      saveWatchProgress('anime', id, {
        episode: resolvedEpisode,
        progress: 0.35,
      });
      navigate(`/play/anime/${id}/${resolvedEpisode}`);
    }
  };

  const handlePlayFromBeginning = () => {
    if (!id) return;
    if (type === 'movie') {
      saveWatchProgress('movie', id, { progress: 0.05 });
      navigate(`/play/movie/${id}`);
    } else if (type === 'tv') {
      saveWatchProgress('tv', id, { season: 1, episode: 1, progress: 0.1 });
      navigate(`/play/tv/${id}/1/1`);
    } else if (type === 'anime') {
      saveWatchProgress('anime', id, { episode: 1, progress: 0.1 });
      navigate(`/play/anime/${id}/1`);
    }
  };

  const handleEpisodeSelectFromPopover = (epNum: number, sNum?: number) => {
    if (!id) return;
    setShowMoreEpisodes(false);
    if (type === 'tv') {
      const targetS = sNum || selectedPopoverSeason || resolvedSeason;
      saveWatchProgress('tv', id, { season: targetS, episode: epNum, progress: 0.35 });
      navigate(`/play/tv/${id}/${targetS}/${epNum}`);
    } else if (type === 'anime') {
      saveWatchProgress('anime', id, { episode: epNum, progress: 0.35 });
      navigate(`/play/anime/${id}/${epNum}`);
    }
  };

  const activePopoverEpisodes =
    type === 'anime'
      ? seasonData?.episodes || []
      : popoverSeasonData?.episodes || seasonData?.episodes || [];

  return (
    <div className="min-h-screen bg-black font-sans text-white relative overflow-hidden">
      {/* Minimal Top Back Button */}
      <div className="absolute top-0 left-0 p-6 z-40 flex items-center gap-4">
        <button
          onClick={handleBack}
          className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
          aria-label="Go Back"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Full-Viewport Cinematic Watch Page */}
      <div className="w-full relative bg-black">
        <WatchPageContent
          item={data}
          type={type}
          seasonNumber={type === 'tv' ? resolvedSeason : 1}
          episodeNumber={type === 'tv' || type === 'anime' ? resolvedEpisode : 1}
          seasonData={type === 'tv' || type === 'anime' ? seasonData : undefined}
          hasProgress={hasProgress}
          progressPercent={progressPercent}
          onPlay={handlePrimaryPlay}
          onPlayFromBeginning={handlePlayFromBeginning}
          onOpenMoreEpisodes={() => {
            setSelectedPopoverSeason(resolvedSeason);
            setShowMoreEpisodes(true);
          }}
        />
      </div>

      {/* Interactive More Episodes Popover (Anime & TV Series Only) */}
      {(type === 'tv' || type === 'anime') && (
        <MoreEpisodesPopover
          isOpen={showMoreEpisodes}
          onClose={() => setShowMoreEpisodes(false)}
          type={type}
          title={data.title || data.name || 'Episodes'}
          backdropPath={data.backdrop_path}
          seasons={type === 'tv' ? data.seasons || [] : undefined}
          selectedSeason={selectedPopoverSeason}
          activePlayingSeason={resolvedSeason}
          currentEpisode={resolvedEpisode}
          episodes={activePopoverEpisodes}
          loadingEpisodes={loadingEpisodes}
          onSeasonChange={(newSeason) => setSelectedPopoverSeason(newSeason)}
          onEpisodeSelect={handleEpisodeSelectFromPopover}
        />
      )}
    </div>
  );
}
