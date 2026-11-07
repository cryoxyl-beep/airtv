import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAnimeDetails } from '../api/anilist';
import { fetchDetails, fetchTVSeason, IMAGE_BASE_URL_W500 } from '../api/tmdb';
import { buildAnimeEpisodeList } from '../api/animeResolver';
import { extractAnimeSeasons } from '../api/animeRelations';
import EpisodeOverlay from '../components/EpisodeOverlay';
import AnimeVidstackPlayer from '../components/AnimeVidstackPlayer';
import MiyoroVidstackPlayer from '../components/MiyoroVidstackPlayer';
import MiyoroLoader from '../components/MiyoroLoader';
import { fetchAnivaultStream, AnimeStreamResult } from '../api/anivault';
import { fetchMovyPlay, fetchMovySeason, MovySource, MovySubtitle } from '../api/movy';
import { buildMovieProviderUrl, buildSeriesProviderUrl, buildAnimeProviderUrl, Provider, ProviderOptions } from '../utils/providers';
import { saveWatchProgress, getWatchProgress, getVideoMutedPreference } from '../utils/preferences';
import { ListVideo, RefreshCw } from 'lucide-react';
import { LoadingButton } from '../components/MiyoroSpinner';

export default function PlayerPage({ type: propType }: { type?: 'movie' | 'tv' | 'anime' }) {
  const { type: paramType, id, season, episode } = useParams();
  const navigate = useNavigate();
  
  const type = propType || paramType;

  const [data, setData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);
  const [provider, setProvider] = useState<Provider>('miyoro');
  const [vidriftError, setVidriftError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Dedicated Native Anime HLS State (Server: Miyoro)
  const [animeStream, setAnimeStream] = useState<AnimeStreamResult | null>(null);
  const [animeStreamLoading, setAnimeStreamLoading] = useState<boolean>(false);
  const [animeStreamError, setAnimeStreamError] = useState<string | null>(null);

  // Dedicated Native Movie & TV Movy Stream State (Server: Miyoro)
  const [movySources, setMovySources] = useState<MovySource[]>([]);
  const [movySubtitles, setMovySubtitles] = useState<MovySubtitle[]>([]);
  const [movyLoading, setMovyLoading] = useState<boolean>(false);
  const [movyError, setMovyError] = useState<string | null>(null);

  const activeSeason = type === 'tv' ? (season ? parseInt(season, 10) : 1) : undefined;
  const activeEpisode = episode ? parseInt(episode, 10) : 1;

  useEffect(() => {
    if (id && type) {
      saveWatchProgress(type, id, {
        season: activeSeason,
        episode: type === 'movie' ? undefined : activeEpisode,
        progress: 0.35,
      });
    }
  }, [id, type, activeSeason, activeEpisode]);

  // Fetch native anime HLS stream with Anivault API when Server: Miyoro is selected
  useEffect(() => {
    if (type !== 'anime' || !id || provider !== 'miyoro') return;

    let isMounted = true;
    const controller = new AbortController();

    setAnimeStreamLoading(true);
    setAnimeStreamError(null);

    fetchAnivaultStream(id, activeEpisode, undefined, controller.signal)
      .then((result) => {
        if (!isMounted) return;
        setAnimeStream(result);
        setAnimeStreamLoading(false);
      })
      .catch((err) => {
        if (!isMounted || controller.signal.aborted) return;
        console.error('Failed to load anime HLS stream from Anivault:', err);
        setAnimeStreamError(
          'Unable to load Miyoro native video stream. You can retry or switch to VidRift / other servers above.'
        );
        setAnimeStreamLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [type, id, activeEpisode, provider]);

  // Fetch native movie & TV stream with Movy API when Server: Miyoro is selected
  useEffect(() => {
    if (type === 'anime' || !id || provider !== 'miyoro') return;

    let isMounted = true;
    const controller = new AbortController();

    setMovyLoading(true);
    setMovyError(null);
    setMovySources([]);
    setMovySubtitles([]);

    fetchMovyPlay(type as 'movie' | 'tv', id, activeSeason, activeEpisode, controller.signal)
      .then((res) => {
        if (!isMounted) return;
        if (res.sources && res.sources.length > 0) {
          setMovySources(res.sources);
          setMovySubtitles(res.subtitles || []);
        } else {
          setMovyError('Stream unavailable. You can retry or switch to another server.');
        }
        setMovyLoading(false);
      })
      .catch((err) => {
        if (!isMounted || controller.signal.aborted) return;
        console.error('Failed to load Movy stream:', err);
        setMovyError('Stream unavailable. You can retry or switch to another server.');
        setMovyLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [type, id, activeSeason, activeEpisode, provider]);

  // Load media details and season/episode info
  useEffect(() => {
    const loadData = async () => {
      if (!id || !type) return;
      setLoading(true);
      try {
        let details;
        if (type === 'anime') {
          details = await fetchAnimeDetails(parseInt(id));
          if (details) {
            const numEpisodes = details.number_of_episodes || 12;
            const mergedEpisodes = await buildAnimeEpisodeList(parseInt(id), numEpisodes);
            details.animeGroup = { seasons: extractAnimeSeasons(details.anilist_raw) };
            setSeasonData({ episodes: mergedEpisodes });
          }
        } else {
          details = await fetchDetails(parseInt(id), type as 'movie' | 'tv');
          if (type === 'tv') {
            try {
              const seasonDetails = await fetchTVSeason(parseInt(id), activeSeason);
              setSeasonData(seasonDetails);
            } catch (e) {
              console.warn('TMDB season fetch failed, attempting Movy season:', e);
              try {
                const movySeason = await fetchMovySeason(id, activeSeason || 1);
                setSeasonData({ episodes: movySeason.episodes });
              } catch (movyErr) {
                console.error('Movy season fetch also failed:', movyErr);
              }
            }
          }
        }
        setData(details);
      } catch (e) {
        console.error("Failed to load data for player:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, type, activeSeason]);

  // Centralized, strictly secured message listener for Vidly & VidRift playback events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || typeof payload !== 'object') return;

      // Security: Validate official Vidly origin
      if (event.origin === 'https://vidly.pro') {
        if (payload.type === 'VIDLY_PLAYER_EVENT' && payload.data) {
          const { event: vEvent, currentTime, duration: vDur, season: vSeason, episode: vEpisode } = payload.data;
          const curTime = Number(currentTime);
          const dur = Number(vDur);
          if (!isNaN(curTime) && !isNaN(dur) && dur > 0) {
            const progress = Math.min(1, Math.max(0, curTime / dur));
            const isEnded = vEvent === 'ended' || progress >= 0.98;
            if (type === 'anime') {
              const ep = Number(vEpisode || activeEpisode);
              if (id) {
                saveWatchProgress('anime', id, {
                  episode: ep,
                  progress: isEnded ? 1.0 : progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            } else if (type === 'tv') {
              const s = Number(vSeason || activeSeason || 1);
              const ep = Number(vEpisode || activeEpisode);
              if (id) {
                saveWatchProgress('tv', id, {
                  season: s,
                  episode: ep,
                  progress: isEnded ? 1.0 : progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            } else if (type === 'movie') {
              if (id) {
                saveWatchProgress('movie', id, {
                  progress: isEnded ? 1.0 : progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            }
          }
        } else if (payload.type === 'SYNC_HISTORY' && payload.data) {
          const { duration: sDur, watched: sWatched, season: sSeason, episode: sEp } = payload.data;
          const curTime = Number(sWatched);
          const dur = Number(sDur);
          if (!isNaN(curTime) && !isNaN(dur) && dur > 0) {
            const progress = Math.min(1, Math.max(0, curTime / dur));
            if (type === 'anime') {
              const ep = Number(sEp || activeEpisode);
              if (id) {
                saveWatchProgress('anime', id, {
                  episode: ep,
                  progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            } else if (type === 'tv') {
              const s = Number(sSeason || activeSeason || 1);
              const ep = Number(sEp || activeEpisode);
              if (id) {
                saveWatchProgress('tv', id, {
                  season: s,
                  episode: ep,
                  progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            } else if (type === 'movie') {
              if (id) {
                saveWatchProgress('movie', id, {
                  progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            }
          }
        }
        return;
      }

      // Security: Validate exact official VidRift origin
      if (event.origin !== 'https://embed.vidrift.net') return;

      switch (payload.type) {
        case 'vidrift:progress': {
          const curTime = Number(payload.currentTime);
          const dur = Number(payload.duration);
          if (!isNaN(curTime) && !isNaN(dur) && dur > 0) {
            const progress = Math.min(1, Math.max(0, curTime / dur));
            if (type === 'anime') {
              const animeId = payload.anilist?.id || id;
              const ep = Number(payload.anilist?.episode || activeEpisode);
              if (animeId) {
                saveWatchProgress('anime', animeId, {
                  episode: ep,
                  progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            } else if (type === 'tv') {
              const s = Number(payload.season || activeSeason || 1);
              const ep = Number(payload.episode || activeEpisode);
              if (id) {
                saveWatchProgress('tv', id, {
                  season: s,
                  episode: ep,
                  progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            } else if (type === 'movie') {
              if (id) {
                saveWatchProgress('movie', id, {
                  progress,
                  currentTime: curTime,
                  duration: dur,
                });
              }
            }
          }
          break;
        }

        case 'vidrift:episode': {
          if (type === 'tv') {
            const newS = Number(payload.season) || activeSeason || 1;
            const newE = Number(payload.episode);
            if (newE && (newS !== activeSeason || newE !== activeEpisode)) {
              navigate(`/play/tv/${id}/${newS}/${newE}`, { replace: true });
            }
          } else if (type === 'anime') {
            const newE = Number(payload.anilist?.episode || payload.episode);
            const targetId = payload.anilist?.id || id;
            if (newE && (newE !== activeEpisode || String(targetId) !== String(id))) {
              navigate(`/play/anime/${targetId}/${newE}`, { replace: true });
            }
          }
          break;
        }

        case 'vidrift:ended': {
          if (id && type) {
            saveWatchProgress(type, id, {
              season: activeSeason,
              episode: type === 'movie' ? undefined : activeEpisode,
              progress: 1.0,
            });
          }
          break;
        }

        case 'vidrift:nextup-play': {
          if (type === 'tv') {
            if (seasonData?.episodes) {
              const currIdx = seasonData.episodes.findIndex((e: any) => e.episode_number === activeEpisode);
              if (currIdx !== -1 && currIdx + 1 < seasonData.episodes.length) {
                const nextEp = seasonData.episodes[currIdx + 1].episode_number;
                navigate(`/play/tv/${id}/${activeSeason}/${nextEp}`, { replace: true });
              }
            }
          } else if (type === 'anime') {
            navigate(`/play/anime/${id}/${activeEpisode + 1}`, { replace: true });
          }
          break;
        }

        case 'vidrift:exit': {
          navigate(-1);
          break;
        }

        case 'vidrift:command-error': {
          console.warn('VidRift reported playback error:', payload);
          setVidriftError('VidRift encountered a playback issue with this stream. You can switch to another server using the menu above.');
          break;
        }

        case 'vidrift:state': {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'vidrift:exit-control', show: false },
            'https://embed.vidrift.net'
          );
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, type, activeSeason, activeEpisode, seasonData, navigate]);

  const handleIframeLoad = () => {
    if (provider !== 'vidrift') return;
    const targetWin = iframeRef.current?.contentWindow;
    if (!targetWin) return;

    // 1. Hide VidRift's built-in Back arrow using documented exit-control postMessage API
    targetWin.postMessage({ type: 'vidrift:exit-control', show: false }, 'https://embed.vidrift.net');
    setTimeout(() => {
      targetWin.postMessage({ type: 'vidrift:exit-control', show: false }, 'https://embed.vidrift.net');
    }, 250);

    // 2. Send resume message if stored progress with currentTime exists
    if (id && type) {
      const saved = getWatchProgress(type, id);
      if (saved?.currentTime && saved.currentTime > 5) {
        targetWin.postMessage(
          { type: 'vidrift:resume', currentTime: saved.currentTime },
          'https://embed.vidrift.net'
        );
      }
    }

    // 3. Synchronize Next Up episode info
    if (seasonData?.episodes) {
      const currIdx = seasonData.episodes.findIndex(
        (e: any) => e.episode_number === activeEpisode
      );
      if (currIdx !== -1 && currIdx + 1 < seasonData.episodes.length) {
        const nextEp = seasonData.episodes[currIdx + 1];
        const still = nextEp.still_path
          ? (nextEp.still_path.startsWith('http') ? nextEp.still_path : `${IMAGE_BASE_URL_W500}${nextEp.still_path}`)
          : '';
        targetWin.postMessage(
          {
            type: 'vidrift:nextup-info',
            next: {
              season: activeSeason || 1,
              episode: nextEp.episode_number,
              name: nextEp.name || `Episode ${nextEp.episode_number}`,
              still,
            },
          },
          'https://embed.vidrift.net'
        );
      }
    }

    // 4. Request initial playback state
    targetWin.postMessage({ type: 'vidrift:get-state' }, 'https://embed.vidrift.net');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <MiyoroLoader size={96} color="#ffffff" />
      </div>
    );
  }

  // Construct dynamic provider options with title, poster, muted preference, and movie metadata
  const mediaTitle = data?.title || data?.name || '';
  const rawBackdrop = data?.backdrop_path || data?.poster_path;
  const posterUrl = rawBackdrop
    ? (rawBackdrop.startsWith('http') ? rawBackdrop : `${IMAGE_BASE_URL_W500}${rawBackdrop}`)
    : '';

  const isAnimeMovie = type === 'anime' && (data?.anime_format === 'movie' || data?.anilist_raw?.format === 'MOVIE');
  const tmdbMovieId = data?.tmdb_id || data?.fribb_mapping?.tmdbMovieId || (isAnimeMovie ? data?.id : undefined);

  const providerOptions: ProviderOptions = {
    title: mediaTitle,
    poster: posterUrl,
    muted: getVideoMutedPreference(),
    isMovie: isAnimeMovie,
    tmdbId: tmdbMovieId,
  };

  let providerUrl: string | null = null;
  if (data && id) {
    if (type === 'movie') {
      providerUrl = buildMovieProviderUrl(provider, id, providerOptions);
    } else if (type === 'tv') {
      providerUrl = buildSeriesProviderUrl(provider, id, activeSeason || 1, activeEpisode, providerOptions);
    } else if (type === 'anime') {
      const malId = data.fribb_mapping?.malId || data.mal_id || data.idmal || data.id_mal;
      providerUrl = buildAnimeProviderUrl(provider, id, malId, activeEpisode, 'sub', 0, providerOptions);
    }
  }

  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(`/play/tv/${id}/${newSeason}/1`, { replace: true });
    } else if (type === 'anime') {
      navigate(`/play/anime/${newSeason}/1`, { replace: true });
    }
  };

  const handleEpisodeChange = (newEpisode: number) => {
    if (type === 'tv') {
      navigate(`/play/tv/${id}/${activeSeason}/${newEpisode}`, { replace: true });
    } else if (type === 'anime') {
      navigate(`/play/anime/${id}/${newEpisode}`, { replace: true });
    }
    setShowEpisodeOverlay(false);
  };

  const showEpisodesButton = type === 'tv' || type === 'anime';

  // Episode calculations for TV series
  const currIdx = seasonData?.episodes?.findIndex((e: any) => e.episode_number === activeEpisode);
  const hasNextEpisode = currIdx !== undefined && currIdx !== -1 && currIdx + 1 < (seasonData?.episodes?.length || 0);
  const nextEpisodeNumber = hasNextEpisode ? seasonData?.episodes[currIdx + 1]?.episode_number : undefined;
  const currentEpObj = seasonData?.episodes?.find((e: any) => e.episode_number === activeEpisode);

  // Saved resume time from preferences
  const savedProgressTime = (() => {
    if (!id || !type) return 0;
    const saved = getWatchProgress(type, id);
    if (type === 'tv') {
      if (saved?.season === activeSeason && saved?.episode === activeEpisode && saved?.currentTime && saved.currentTime > 5) {
        return saved.currentTime;
      }
      return 0;
    }
    if (type === 'movie') {
      return saved?.currentTime && saved.currentTime > 5 ? saved.currentTime : 0;
    }
    return 0;
  })();

  const isNativeMovyPlaying = type !== 'anime' && provider === 'miyoro' && movySources.length > 0 && !movyLoading && !movyError;

  const serverSelectorNode = (
    <div className="relative flex items-center">
      <select
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value as Provider);
          setVidriftError(null);
          setAnimeStreamError(null);
          setMovyError(null);
        }}
        className="bg-[#141414]/90 hover:bg-[#1c1c1c]/95 border border-white/10 shadow-lg backdrop-blur-md text-white rounded-full pl-5 pr-10 py-2.5 outline-none font-medium appearance-none transition-all focus:ring-1 focus:ring-white/20 cursor-pointer text-xs md:text-sm"
      >
        {type === 'anime' ? (
          <>
            <option value="miyoro">Server: Miyoro</option>
            <option value="vidly">Server: Vidly</option>
            <option value="vidrift">Server: VidRift</option>
            <option value="vidnest">Server: Vidnest</option>
            <option value="origami">Server: Origami</option>
            <option value="animepahe">Server: AnimePahe</option>
          </>
        ) : (
          <>
            <option value="miyoro">Server: Miyoro (Native)</option>
            <option value="vidly">Server: Vidly</option>
            <option value="vidrift">Server: VidRift</option>
            <option value="vidnest">Server: Vidnest</option>
            <option value="cinesrc">Server: CineSrc</option>
            <option value="vidfast">Server: VidFast</option>
            <option value="movies111">Server: 111Movies</option>
          </>
        )}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Bar Navigation: Only displayed when not inside native Movy player (which renders its own top bar) */}
      {!isNativeMovyPlaying && (
        <div className="absolute top-0 left-0 right-0 p-4 md:p-6 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2.5 md:gap-3 pointer-events-auto">
            {serverSelectorNode}

            {showEpisodesButton && (
              <button
                onClick={() => setShowEpisodeOverlay(!showEpisodeOverlay)}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[#141414]/90 hover:bg-[#1c1c1c]/95 border border-white/10 shadow-lg backdrop-blur-md flex items-center justify-center transition-all cursor-pointer text-white"
                aria-label="Episodes"
              >
                <ListVideo className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Optional Discreet Error Notification for VidRift */}
      {vidriftError && type !== 'anime' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-[#1c1212]/95 border border-red-500/40 text-white/90 px-5 py-2.5 rounded-full text-xs md:text-sm backdrop-blur-md flex items-center gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.7)] animate-in fade-in duration-200">
          <span>{vidriftError}</span>
          <button 
            onClick={() => setVidriftError(null)} 
            className="text-white/60 hover:text-white transition-colors cursor-pointer text-base leading-none"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Player Area */}
      <div className="flex-1 w-full h-full relative">
        {/* 1. NATIVE ANIME STREAM (Anivault API) */}
        {type === 'anime' && provider === 'miyoro' ? (
          animeStreamLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <MiyoroLoader size={96} color="#ffffff" />
            </div>
          ) : animeStreamError ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-4 text-white px-6 text-center">
              <p className="text-sm md:text-base text-red-400 max-w-md">{animeStreamError}</p>
              <div className="flex items-center gap-3">
                <LoadingButton
                  loading={animeStreamLoading}
                  onClick={() => {
                    setAnimeStreamError(null);
                    setAnimeStreamLoading(true);
                    fetchAnivaultStream(id!, activeEpisode)
                      .then((res) => {
                        setAnimeStream(res);
                        setAnimeStreamLoading(false);
                      })
                      .catch(() => {
                        setAnimeStreamLoading(false);
                        setAnimeStreamError('Unable to connect to stream. Please switch to another server.');
                      });
                  }}
                  className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs md:text-sm hover:bg-white/90 transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry</span>
                </LoadingButton>
                <button
                  onClick={() => setProvider('vidly')}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-xs md:text-sm border border-white/20 transition-all cursor-pointer"
                >
                  Switch to Vidly
                </button>
              </div>
            </div>
          ) : animeStream ? (
            <AnimeVidstackPlayer
              stream={animeStream}
              title={`${mediaTitle} - Episode ${activeEpisode}`}
              poster={posterUrl}
              initialTime={
                (() => {
                  const saved = id ? getWatchProgress('anime', id) : null;
                  return saved?.episode === activeEpisode && saved?.currentTime && saved.currentTime > 5
                    ? saved.currentTime
                    : 0;
                })()
              }
              onProgress={(cur, dur, prog) => {
                if (id) {
                  saveWatchProgress('anime', id, {
                    episode: activeEpisode,
                    progress: prog,
                    currentTime: cur,
                    duration: dur,
                  });
                }
              }}
              onEnded={() => {
                if (id) {
                  saveWatchProgress('anime', id, {
                    episode: activeEpisode,
                    progress: 1.0,
                  });
                }
                const nextEp = activeEpisode + 1;
                const hasNext = seasonData?.episodes?.some(
                  (e: any) => e.episode_number === nextEp
                );
                if (hasNext) {
                  navigate(`/play/anime/${id}/${nextEp}`, { replace: true });
                }
              }}
              onError={(err) => {
                console.warn('Vidstack player playback event error:', err);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <p>Unable to load anime video stream.</p>
            </div>
          )
        ) : /* 2. NATIVE MOVIE & TV STREAM (Movy API + Vidstack Native Player) */
        type !== 'anime' && provider === 'miyoro' ? (
          movyLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <MiyoroLoader size={96} color="#ffffff" />
            </div>
          ) : movyError ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-4 text-white px-6 text-center">
              <p className="text-sm md:text-base text-red-400 max-w-md">{movyError}</p>
              <div className="flex items-center gap-3">
                <LoadingButton
                  loading={movyLoading}
                  onClick={() => {
                    setMovyError(null);
                    setMovyLoading(true);
                    fetchMovyPlay(type as 'movie' | 'tv', id!, activeSeason, activeEpisode)
                      .then((res) => {
                        if (res.sources && res.sources.length > 0) {
                          setMovySources(res.sources);
                          setMovySubtitles(res.subtitles || []);
                        } else {
                          setMovyError('Stream unavailable. You can retry or switch to another server.');
                        }
                        setMovyLoading(false);
                      })
                      .catch(() => {
                        setMovyLoading(false);
                        setMovyError('Stream unavailable. You can retry or switch to another server.');
                      });
                  }}
                  className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs md:text-sm hover:bg-white/90 transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry</span>
                </LoadingButton>
                <button
                  onClick={() => setProvider('vidly')}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-xs md:text-sm border border-white/20 transition-all cursor-pointer"
                >
                  Switch to Vidly
                </button>
              </div>
            </div>
          ) : movySources.length > 0 ? (
            <MiyoroVidstackPlayer
              sources={movySources}
              subtitles={movySubtitles}
              title={mediaTitle}
              poster={posterUrl}
              type={type as 'movie' | 'tv'}
              season={activeSeason}
              episode={activeEpisode}
              episodeTitle={currentEpObj?.name}
              initialTime={savedProgressTime}
              onProgress={(cur, dur, prog) => {
                if (id) {
                  saveWatchProgress(type as 'movie' | 'tv', id, {
                    season: activeSeason,
                    episode: type === 'movie' ? undefined : activeEpisode,
                    progress: prog,
                    currentTime: cur,
                    duration: dur,
                  });
                }
              }}
              onEnded={() => {
                if (id) {
                  saveWatchProgress(type as 'movie' | 'tv', id, {
                    season: activeSeason,
                    episode: type === 'movie' ? undefined : activeEpisode,
                    progress: 1.0,
                  });
                }
                if (type === 'tv' && hasNextEpisode && nextEpisodeNumber) {
                  navigate(`/play/tv/${id}/${activeSeason}/${nextEpisodeNumber}`, { replace: true });
                }
              }}
              onError={(err) => {
                console.warn('Movy Vidstack playback error:', err);
              }}
              onNextEpisode={
                hasNextEpisode && nextEpisodeNumber
                  ? () => navigate(`/play/tv/${id}/${activeSeason}/${nextEpisodeNumber}`, { replace: true })
                  : undefined
              }
              hasNextEpisode={hasNextEpisode}
              onOpenEpisodes={() => setShowEpisodeOverlay(true)}
              onBack={() => navigate(-1)}
              serverSelector={serverSelectorNode}
              provider={provider}
              onSelectProvider={(p) => setProvider(p)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <p>Stream unavailable.</p>
            </div>
          )
        ) : /* 3. 3RD-PARTY PROVIDER IFRAMES (Vidly, VidRift, Vidnest, etc.) */
        providerUrl ? (
          <iframe
            ref={iframeRef}
            key={`iframe-${providerUrl}`}
            src={providerUrl}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={handleIframeLoad}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            <p>Unable to load video source.</p>
          </div>
        )}
      </div>

      {/* Episode Overlay */}
      {showEpisodeOverlay && showEpisodesButton && data && seasonData && (
        <EpisodeOverlay 
          type={type as any}
          data={data}
          seasonData={seasonData}
          currentSeason={activeSeason || 1}
          currentEpisode={activeEpisode}
          onSeasonChange={handleSeasonChange}
          onEpisodeSelect={handleEpisodeChange}
          id={id}
          onClose={() => setShowEpisodeOverlay(false)}
        />
      )}
    </div>
  );
}
