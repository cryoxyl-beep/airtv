import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchDetails, fetchTVSeason } from '../api/tmdb';
import { fetchAnimeDetails } from '../api/anilist';
import { getAnimeSeasonPreference, setAnimeSeasonPreference } from '../utils/preferences';
import { 
  getMovieProviderUrl, 
  getSeriesProviderUrl, 
  getAnimeProviderUrl, 
  MovieProvider, 
  SeriesProvider, 
  AnimeProvider 
} from '../utils/providers';
import SeasonSelector from '../components/SeasonSelector';
import EpisodeList from '../components/EpisodeList';
import EpisodePanel from '../components/EpisodePanel';
import DetailHero from '../components/DetailHero';
import { ArrowLeft, ListVideo, Settings2 } from 'lucide-react';

interface WatchPageProps {
  type: 'movie' | 'tv' | 'anime';
}

export default function WatchPage({ type }: WatchPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [data, setData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Local state for Detail Page selections
  const [seasonNumber, setSeasonNumber] = useState<number>(1);
  
  // Determine flow state from URL
  const isPlayerView = searchParams.get('play') === 'true' || searchParams.get('action') === 'watch';
  const paramSeason = searchParams.get('season') ? parseInt(searchParams.get('season')!) : null;
  const paramEpisode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : null;
  
  // Decide if iframe should actually be mounted
  const shouldMountIframe = isPlayerView && (type === 'movie' || paramEpisode !== null);

  // Player overlay state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [manualPanelOpen, setManualPanelOpen] = useState(false);
  
  // Provider Selection State
  const [movieProvider, setMovieProvider] = useState<MovieProvider>('vidnest');
  const [seriesProvider, setSeriesProvider] = useState<SeriesProvider>('vidnest');
  const [animeProvider, setAnimeProvider] = useState<AnimeProvider>('vidnest');
  const [audioLanguage, setAudioLanguage] = useState<'sub' | 'dub'>('sub');
  
  const [showProviderMenu, setShowProviderMenu] = useState(false);

  // Auto-open panel if entering player view without an episode selected
  useEffect(() => {
    if (isPlayerView && !shouldMountIframe && (type === 'tv' || type === 'anime')) {
      setIsPanelOpen(true);
    }
  }, [isPlayerView, shouldMountIframe, type]);

  useEffect(() => {
    let isRedirecting = false;
    const loadContent = async () => {
      if (!id) return;
      setLoading(true);
      try {
        if (type === 'movie') {
          const details = await fetchDetails(parseInt(id), 'movie');
          setData(details);
        } else if (type === 'anime') {
          const details = await fetchAnimeDetails(parseInt(id));
          setData(details);
          
          if (details.animeGroup?.groupId) {
            const prefSeason = getAnimeSeasonPreference(details.animeGroup.groupId);
            if (prefSeason && prefSeason !== parseInt(id)) {
              isRedirecting = true;
              navigate(`/anime/${prefSeason}`, { replace: true });
              return;
            }
          }
          
          let anilistEpisodes = (details.episodes || []).map((ep: any) => {
            const epNum = ep.number;
            const epName = ep.title?.english || ep.title?.romaji || `Episode ${epNum}`;
            const epThumb = ep.image;
            return {
              id: ep.id || epNum,
              episode_number: epNum,
              name: epName,
              overview: '',
              still_path: epThumb
            };
          });
          
          let mergedEpisodes = [...anilistEpisodes];
          
          if (details.tmdb_id && details.tmdb_type !== 'movie') {
            try {
              const targetSeason = details.tmdb_season || 1;
              const tmdbSeasonData = await fetchTVSeason(details.tmdb_id, targetSeason);
              
              if (tmdbSeasonData && tmdbSeasonData.episodes) {
                mergedEpisodes = mergedEpisodes.map(ep => {
                  const tmdbEp = tmdbSeasonData.episodes.find((t: any) => t.episode_number === ep.episode_number);
                  return {
                    ...ep,
                    still_path: tmdbEp?.still_path || ep.still_path,
                    runtime: tmdbEp?.runtime || ep.runtime
                  };
                });
              }
            } catch (e) {
              console.warn("Failed to fetch TMDB season data for anime", e);
            }
          }
          
          setSeasonData({ episodes: mergedEpisodes });
          setSeasonNumber(1);
          
        } else if (type === 'tv') {
          const details = await fetchDetails(parseInt(id), 'tv');
          setData(details);
          
          const seasons = details.seasons || [];
          let targetSeason = paramSeason || seasonNumber;
          const seasonExists = seasons.find((s: any) => s.season_number === targetSeason);
          
          if (!seasonExists && seasons.length > 0) {
            const validSeason = seasons.find((s: any) => s.season_number > 0) || seasons[0];
            targetSeason = validSeason.season_number;
            setSeasonNumber(targetSeason);
          }
          try {
            const season = await fetchTVSeason(parseInt(id), targetSeason);
            setSeasonData(season);
          } catch (e: any) {
            console.error("fetchTVSeason failed:", e);
          }
        }
      } catch (err: any) {
        console.error("Failed to load watch data:", err.message || err);
        setError(true);
      } finally {
        if (!isRedirecting) {
          setLoading(false);
        }
      }
    };
    
    loadContent();
  }, [id, type]);

  useEffect(() => {
    if (type === 'tv' && id && !loading && data) {
      const loadSeason = async () => {
        try {
          const season = await fetchTVSeason(parseInt(id), seasonNumber);
          setSeasonData(season);
        } catch (e: any) {
          console.error("fetchTVSeason failed:", e);
        }
      };
      loadSeason();
    }
  }, [seasonNumber, id, type]);

  // Window message listener for basic player events if provider supports postMessage
  useEffect(() => {
    if (!isPlayerView) return;
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg && msg.event === 'paused') {
          setIsPanelOpen(true);
        } else if (msg && (msg.event === 'playing' || msg.event === 'play')) {
          setIsPanelOpen(false);
          setManualPanelOpen(false);
        }
      } catch (e) {
        // Not JSON or unhandled
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPlayerView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center text-white gap-4">
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

  const handleSeasonChange = (newSeason: number) => {
    setSeasonNumber(newSeason);
    if (type === 'anime' && data?.animeGroup?.groupId) {
      setAnimeSeasonPreference(data.animeGroup.groupId, newSeason);
      navigate(`/anime/${newSeason}`, { replace: true });
    }
  };

  const currentSeason = paramSeason || seasonNumber;
  const currentEpisode = paramEpisode || 1;

  // -------------------------------------------------------------
  // DETAIL VIEW STATE
  // -------------------------------------------------------------
  if (!isPlayerView) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex flex-col relative font-sans text-white pb-20">
        <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
          <button 
            onClick={handleBack}
            className="pointer-events-auto w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
            aria-label="Go Back"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

        <DetailHero 
          item={data} 
          type={type} 
          onWatchNow={() => {
            if (type === 'movie') {
              navigate(`?play=true`);
            } else {
              const isSinglePlayable = seasonData?.episodes?.length === 1 && (!data.seasons || data.seasons.length <= 1);
              if (isSinglePlayable) {
                const ep = seasonData.episodes[0];
                navigate(`?action=watch&season=${seasonNumber}&episode=${ep.episode_number}`);
              } else {
                navigate(`?action=watch`);
              }
            }
          }} 
        />
        
        {(type === 'tv' || type === 'anime') && seasonData?.episodes && (
           <div className="px-6 md:px-12 lg:px-16 py-10 relative z-10 max-w-7xl mx-auto w-full">
             <div className="flex items-center gap-4 mb-6">
               <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">Episodes</h2>
               {type === 'tv' && data.seasons && (
                 <SeasonSelector 
                   seasons={data.seasons} 
                   currentSeason={seasonNumber} 
                   onSeasonChange={handleSeasonChange} 
                 />
               )}
             </div>
             <EpisodeList 
               episodes={seasonData.episodes} 
               currentEpisode={0} 
               onEpisodeSelect={(epNum) => {
                 navigate(`?action=watch&season=${seasonNumber}&episode=${epNum}`);
               }} 
               isAnime={type === 'anime'}
             />
           </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // PLAYER VIEW STATE (Actual Watch Player)
  // -------------------------------------------------------------
  let providerUrl = '';
  if (shouldMountIframe) {
    if (type === 'movie') {
      providerUrl = getMovieProviderUrl(id as string, movieProvider);
    } else if (type === 'tv') {
      providerUrl = getSeriesProviderUrl(id as string, currentSeason, currentEpisode, seriesProvider);
    } else if (type === 'anime') {
      providerUrl = getAnimeProviderUrl(id as string, currentEpisode, animeProvider, audioLanguage, data?.idMal);
    }
  }

  const hasEpisodes = type === 'tv' || type === 'anime';

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex flex-col relative font-sans text-white">
      {/* Top Nav */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 flex items-start justify-between pointer-events-none">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          className="pointer-events-auto w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
          aria-label="Go Back"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        {/* Provider Settings */}
        {shouldMountIframe && (
          <div className="relative pointer-events-auto">
            <button 
              onClick={() => setShowProviderMenu(!showProviderMenu)}
              className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all"
              aria-label="Settings"
            >
              <Settings2 size={20} className="text-white/80" />
            </button>
            
            {showProviderMenu && (
              <div className="absolute top-full right-0 mt-3 w-64 bg-[#141414]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-4 flex flex-col gap-4 z-50">
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Server Selection</h3>
                
                {type === 'movie' && (
                  <div className="flex flex-col gap-2">
                    {(['vidnest', 'cinesrc', 'vidfast', 'movies111'] as MovieProvider[]).map(p => (
                      <button 
                        key={p} 
                        onClick={() => { setMovieProvider(p); setShowProviderMenu(false); }}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${movieProvider === p ? 'bg-white text-black' : 'hover:bg-white/10 text-white/80'}`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {type === 'tv' && (
                  <div className="flex flex-col gap-2">
                    {(['vidnest', 'cinesrc', 'vidfast', 'movies111'] as SeriesProvider[]).map(p => (
                      <button 
                        key={p} 
                        onClick={() => { setSeriesProvider(p); setShowProviderMenu(false); }}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${seriesProvider === p ? 'bg-white text-black' : 'hover:bg-white/10 text-white/80'}`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {type === 'anime' && (
                  <>
                    <div className="flex flex-col gap-2">
                      <h4 className="text-xs text-white/40 mb-1">Server</h4>
                      {(['vidnest', 'origami', 'animepahe'] as AnimeProvider[]).map(p => (
                        <button 
                          key={p} 
                          onClick={() => { setAnimeProvider(p); setShowProviderMenu(false); }}
                          className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${animeProvider === p ? 'bg-white text-black' : 'hover:bg-white/10 text-white/80'}`}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                      <h4 className="text-xs text-white/40 mb-1">Audio</h4>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setAudioLanguage('sub'); setShowProviderMenu(false); }}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${audioLanguage === 'sub' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white/80'}`}
                        >
                          Sub
                        </button>
                        <button 
                          onClick={() => { setAudioLanguage('dub'); setShowProviderMenu(false); }}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${audioLanguage === 'dub' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white/80'}`}
                        >
                          Dub
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Video Area */}
      <div className="flex-1 w-full relative bg-black flex items-center justify-center">
        {shouldMountIframe ? (
          <iframe
            src={providerUrl}
            className="w-full h-full border-none outline-none bg-black"
            allowFullScreen
            allow="autoplay; encrypted-media"
            title="Video Player"
          />
        ) : (
          <div className="text-white/40 flex flex-col items-center gap-4">
            <ListVideo size={48} className="opacity-50" />
            <p className="text-lg font-medium">Please select an episode from the menu</p>
          </div>
        )}
        
        {/* Manual Episode Toggle Overlay Button */}
        {hasEpisodes && shouldMountIframe && (
          <div className="absolute bottom-6 right-6 z-40">
            <button 
              onClick={() => {
                setIsPanelOpen(!isPanelOpen);
                setManualPanelOpen(true);
              }}
              className="flex items-center gap-2 bg-[#1A1A1A]/90 hover:bg-[#252525] border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md text-white px-5 py-3 rounded-full font-semibold transition-all hover:scale-105"
            >
              <ListVideo size={20} />
              <span className="hidden sm:inline">Episodes</span>
            </button>
          </div>
        )}
      </div>

      {/* Episode Panel Drawer/Overlay */}
      {hasEpisodes && (
        <EpisodePanel
          isOpen={isPanelOpen || manualPanelOpen}
          onClose={() => {
            setIsPanelOpen(false);
            setManualPanelOpen(false);
          }}
          type={type}
          data={data}
          seasonData={seasonData}
          seasonNumber={currentSeason}
          episodeNumber={currentEpisode}
          onSeasonChange={(newSeason) => {
            setSeasonNumber(newSeason);
            if (type === 'anime' && data?.animeGroup?.groupId) {
              setAnimeSeasonPreference(data.animeGroup.groupId, newSeason);
              navigate(`/anime/${newSeason}?action=watch`);
            }
          }}
          onEpisodeChange={(newEpisode) => {
            navigate(`?action=watch&season=${currentSeason}&episode=${newEpisode}`, { replace: true });
            setIsPanelOpen(false);
            setManualPanelOpen(false);
          }}
          isAnime={type === 'anime'}
        />
      )}
    </div>
  );
}
