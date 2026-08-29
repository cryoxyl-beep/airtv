import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAnimeDetails } from '../api/anilist';
import { fetchDetails, fetchTVSeason } from '../api/tmdb';
import { buildAnimeEpisodeList } from '../api/animeResolver';
import { extractAnimeSeasons } from '../api/animeRelations';
import EpisodeOverlay from '../components/EpisodeOverlay';
import { buildMovieProviderUrl, buildSeriesProviderUrl, buildAnimeProviderUrl, Provider } from '../utils/providers';
import { ArrowLeft, ListVideo } from 'lucide-react';

export default function PlayerPage({ type: propType }: { type?: 'movie' | 'tv' | 'anime' }) {
  const { type: paramType, id, season, episode } = useParams();
  const navigate = useNavigate();
  
  const type = propType || paramType;

  const [data, setData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);
  const [provider, setProvider] = useState<Provider>('vidnest');

  const activeSeason = type === 'tv' ? (season ? parseInt(season, 10) : 1) : undefined;
  const activeEpisode = episode ? parseInt(episode, 10) : 1;

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
            const seasonDetails = await fetchTVSeason(parseInt(id), activeSeason);
            setSeasonData(seasonDetails);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  let providerUrl: string | null = null;
  if (data && id) {
    if (type === 'movie') {
      providerUrl = buildMovieProviderUrl(provider, id);
    } else if (type === 'tv') {
      providerUrl = buildSeriesProviderUrl(provider, id, activeSeason || 1, activeEpisode);
    } else if (type === 'anime') {
      const malId = data.fribb_mapping?.malId || data.mal_id || data.idmal || data.id_mal;
      providerUrl = buildAnimeProviderUrl(provider, id, malId, activeEpisode, 'sub');
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Bar Navigation */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => navigate(-1)}
          className="pointer-events-auto w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
          aria-label="Go Back"
        >
          <ArrowLeft size={24} className="text-white group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="flex items-center gap-4">
          {/* Server/Provider Selector */}
          <div className="relative pointer-events-auto flex items-center">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md text-white rounded-full pl-5 pr-10 py-2.5 outline-none font-medium appearance-none hover:bg-[#252525]/90 transition-all focus:ring-2 focus:ring-white/20 cursor-pointer text-sm"
            >
              <option value="vidnest">Server: Vidnest</option>
              {type === 'anime' ? (
                <>
                  <option value="origami">Server: Origami</option>
                  <option value="animepahe">Server: AnimePahe</option>
                </>
              ) : (
                <>
                  <option value="cinesrc">Server: CineSrc</option>
                  <option value="vidfast">Server: VidFast</option>
                  <option value="movies111">Server: 111Movies</option>
                </>
              )}
            </select>
            {/* Custom dropdown arrow */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          {showEpisodesButton && (
            <button
              onClick={() => setShowEpisodeOverlay(!showEpisodeOverlay)}
              className="pointer-events-auto w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
              aria-label="Episodes"
            >
              <ListVideo className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Main Player */}
      <div className="flex-1 w-full h-full relative">
        {providerUrl ? (
          <iframe
            key={`iframe-${providerUrl}`}
            src={providerUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
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
