import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAnimeDetails } from '../api/anilist';
import { groupCache } from '../api/anilistGroups';
import { fetchDetails, fetchTVSeason } from '../api/tmdb';
import { setAnimeSeasonPreference } from '../utils/preferences';
import EpisodeOverlay from '../components/EpisodeOverlay';
import { buildMovieProviderUrl, buildSeriesProviderUrl, buildAnimeProviderUrl } from '../utils/providers';
import { ArrowLeft, ListVideo } from 'lucide-react';

export default function PlayerPage() {
  const { type, id, season, episode } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);

  const activeSeason = season ? parseInt(season, 10) : 1;
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
            details.animeGroup = groupCache.get(parseInt(id));
            
            // Generate basic episode array for anime if we don't have tmdb-like season format
            const numEpisodes = details.number_of_episodes || 1;
            const streamingEps = details.anilist_raw?.streamingEpisodes || [];
            
            let anilistEpisodes = [];
            if (streamingEps.length > 0) {
              anilistEpisodes = streamingEps.map((se: any, i: number) => {
                let epNum = i + 1;
                const match = se.title?.match(/Episode\s+(\d+)|^\s*(\d+)\s*-/i);
                if (match) epNum = parseInt(match[1] || match[2], 10);
                
                let epName = `Episode ${epNum}`;
                if (se.title) {
                  const parts = se.title.split('-');
                  if (parts.length > 1) epName = parts.slice(1).join('-').trim();
                  else epName = se.title;
                }
                return {
                  id: `ep-${epNum}`,
                  episode_number: epNum,
                  name: epName,
                  still_path: se.thumbnail
                };
              });
            } else {
              anilistEpisodes = Array.from({ length: numEpisodes }, (_, i) => ({
                id: `ep-${i + 1}`,
                episode_number: i + 1,
                name: `Episode ${i + 1}`,
                still_path: details.backdrop_path || details.poster_path
              }));
            }
            setSeasonData({ episodes: anilistEpisodes });
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
      providerUrl = buildMovieProviderUrl('vidnest', id);
    } else if (type === 'tv') {
      providerUrl = buildSeriesProviderUrl('vidnest', id, activeSeason, activeEpisode);
    } else if (type === 'anime') {
      const malId = data.mal_id || data.idmal || data.id_mal;
      providerUrl = buildAnimeProviderUrl('vidnest', id, malId, activeEpisode, 'sub');
    }
  }

  const handleSeasonChange = (newSeason: number) => {
    if (type === 'tv') {
      navigate(`/play/tv/${id}/${newSeason}/1`, { replace: true });
    } else if (type === 'anime') {
      setAnimeSeasonPreference(data.animeGroup.groupId, newSeason);
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
          currentSeason={activeSeason}
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
