import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchAnimeDetails } from '../api/anilist';
import { fetchDetails, fetchTVSeason, getSeedItem } from '../api/tmdb';
import { buildAnimeEpisodeList } from '../api/animeResolver';
import { extractAnimeSeasons } from '../api/animeRelations';
import WatchPageContent from '../components/WatchPage';
import SeasonSelector from '../components/SeasonSelector';
import EpisodeList from '../components/EpisodeList';
import { ArrowLeft } from 'lucide-react';
import WatchPageSkeleton from '../components/WatchPageSkeleton';

interface WatchPageProps {
  type: 'movie' | 'tv' | 'anime';
}

export default function WatchPage({ type }: WatchPageProps) {
  const { id, season, episode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const initialSeed = (location.state as any)?.item || (id ? getSeedItem(type, parseInt(id, 10)) : null);

  const [data, setData] = useState<any>(initialSeed);
  const [seasonData, setSeasonData] = useState<any>(() => {
    if (type === 'tv' && initialSeed?.['season/1'] && (!season || parseInt(season, 10) === 1)) {
      return initialSeed['season/1'];
    }
    return null;
  });
  const [loading, setLoading] = useState(!initialSeed);
  const [loadingEpisodes, setLoadingEpisodes] = useState(type === 'tv' || type === 'anime');
  const [error, setError] = useState(false);

  const activeSeason = season ? parseInt(season, 10) : 1;
  const activeEpisode = episode ? parseInt(episode, 10) : 1;

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

            // Immediately show fast provisional episodes if streamingEpisodes exist while TVDB/Jikan resolves
            if (Array.isArray(streamEps) && streamEps.length > 0 && !seasonData) {
              setSeasonData({
                episodes: streamEps.map((se: any, idx: number) => ({
                  episode_number: idx + 1,
                  name: se.title ? se.title.replace(/^Episode\s+\d+\s*-\s*/i, '') : `Episode ${idx + 1}`,
                  overview: '',
                  still_path: se.thumbnail || details.backdrop_path
                }))
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
          // Run fetchDetails (which includes season/1) and target season in parallel if targetSeason !== 1
          const [details, explicitSeason] = await Promise.all([
            fetchDetails(numericId, 'tv'),
            activeSeason !== 1 ? fetchTVSeason(numericId, activeSeason).catch(() => null) : Promise.resolve(null)
          ]);

          if (!mounted) return;
          setData(details);
          setLoading(false);

          const seasons = details.seasons || [];
          let targetSeason = activeSeason;
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
            setLoadingEpisodes(false);
          } else if (explicitSeason) {
            setSeasonData(explicitSeason);
            setLoadingEpisodes(false);
          } else {
            try {
              const sData = await fetchTVSeason(numericId, targetSeason);
              if (mounted) setSeasonData(sData);
            } catch (e) {
              console.error("fetchTVSeason failed:", e);
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
        console.error("Failed to load watch data:", err.message || err);
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

  // Load season data when activeSeason changes
  useEffect(() => {
    if (type === 'tv' && id && data) {
      const numericId = parseInt(id, 10);
      if (activeSeason === 1 && data['season/1']) {
        setSeasonData(data['season/1']);
        return;
      }
      let mounted = true;
      const loadSeason = async () => {
        try {
          const seasonRes = await fetchTVSeason(numericId, activeSeason);
          if (mounted) setSeasonData(seasonRes);
        } catch (e: any) {
          console.error("fetchTVSeason failed:", e);
        }
      };
      loadSeason();
      return () => {
        mounted = false;
      };
    }
  }, [activeSeason, id, type, data]);

  if (loading && !data) {
    return (
      <div className={`min-h-screen bg-black font-sans text-white relative ${(type === 'tv' || type === 'anime') ? 'pb-20' : 'overflow-hidden'}`}>
        <div className="absolute top-0 left-0 p-6 z-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse" />
        </div>
        <div className="w-full relative bg-black pt-0 lg:pt-0">
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

  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(`/watch/tv/${id}/${newSeason}/1`, { replace: false });
    }
  };

  const handleEpisodeChange = (newEpisode: number) => {
    if (type === 'tv') {
      navigate(`/play/tv/${id}/${activeSeason}/${newEpisode}`, { replace: false });
    } else if (type === 'anime') {
      navigate(`/play/anime/${id}/${newEpisode}`, { replace: false });
    }
  };

  const showBottomSection = (type === 'tv' || type === 'anime');

  return (
    <div className={`min-h-screen bg-black font-sans text-white relative ${showBottomSection ? 'pb-20' : 'overflow-hidden'}`}>
      {/* Top Nav (Minimal) */}
      <div className="absolute top-0 left-0 p-6 z-50 flex items-center gap-4">
        <button 
          onClick={handleBack}
          className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
          aria-label="Go Back"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Main Video Area */}
      <div className="w-full relative bg-black pt-0 lg:pt-0">
        <WatchPageContent 
          item={data} 
          type={type} 
          seasonNumber={(type === 'tv' || type === 'anime') ? activeSeason : undefined}
          episodeNumber={(type === 'tv' || type === 'anime') ? activeEpisode : undefined}
          seasonData={(type === 'tv' || type === 'anime') ? seasonData : undefined}
          forceFullScreen={!showBottomSection}
          onPlay={() => {
            if (type === 'movie') {
              navigate(`/play/movie/${id}`);
            } else if (type === 'tv') {
              navigate(`/play/tv/${id}/${activeSeason}/${activeEpisode}`);
            } else if (type === 'anime') {
              navigate(`/play/anime/${id}/${activeEpisode}`);
            }
          }}
        />
      </div>

      {/* Details & Episode Selection Area */}
      {showBottomSection && (
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 pb-10 pt-0">
          <div className="mt-0">
            {/* Season Selector */}
            {type === 'tv' && data.seasons && (
              <div className="mb-8">
                <SeasonSelector 
                  seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                  currentSeason={activeSeason}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}

            {seasonData?.episodes?.length > 0 ? (
              <>
                <div className="text-white/60 mb-6 font-medium text-lg">
                  {seasonData.episodes.length} Episodes
                </div>
                <EpisodeList 
                  episodes={seasonData.episodes} 
                  currentEpisode={episode ? parseInt(episode, 10) : undefined}
                  onEpisodeSelect={handleEpisodeChange}
                  isAnime={type === 'anime'}
                />
              </>
            ) : loadingEpisodes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10 mt-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-video bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
