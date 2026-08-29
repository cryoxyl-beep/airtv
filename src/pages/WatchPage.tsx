import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAnimeDetails } from '../api/anilist';
import { fetchDetails, fetchTVSeason, fetchTrailer, IMAGE_BASE_URL } from '../api/tmdb';
import { buildAnimeEpisodeList } from '../api/animeResolver';
import { extractAnimeSeasons } from '../api/animeRelations';
import WatchPageContent from '../components/WatchPage';
import EpisodeOverlay from '../components/EpisodeOverlay';
import { buildMovieProviderUrl, buildSeriesProviderUrl, buildAnimeProviderUrl } from '../utils/providers';
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
  
  const [data, setData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Derived directly from the route, no React state
  const activeSeason = season ? parseInt(season, 10) : 1;
  const activeEpisode = episode ? parseInt(episode, 10) : 1;
    
  


  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(false);
      let isRedirecting = false;
      try {
        if (!id) throw new Error('No ID');
        
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
        }
        
        setData(details);

        if (type === 'tv') {
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

  // Load season data when activeSeason state changes, but don't reload everything
  useEffect(() => {
    if (type === 'tv' && id && !loading && data) {
      const loadSeason = async () => { try { const season = await fetchTVSeason(parseInt(id), activeSeason);
          setSeasonData(season);
        } catch (e: any) {
          console.error("fetchTVSeason failed:", e);
        }
      };
      loadSeason();
    }
  }, [activeSeason, id, type]);

  if (loading) {
      return (
      <div className={`min-h-screen bg-[#0b0b0b] font-sans text-white relative ${(type === 'tv' || type === 'anime') ? 'pb-20' : 'overflow-hidden'}`}>
        {/* Top Nav Placeholder */}
        <div className="absolute top-0 left-0 p-6 z-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse" />
        </div>

        {/* Player Skeleton */}
        <div className="w-full relative bg-\[#0b0b0b\] pt-0 lg:pt-0">
          <WatchPageSkeleton type={type === 'anime' ? 'tv' : type} />
        </div>

        {/* TV Specific Sections Skeleton */}
        {(type === 'tv' || type === 'anime') && (
          <div className="max-w-[1600px] mx-auto px-6 md:px-12 pb-10 pt-2 md:pt-4">
            <div className="mt-2">
              <div className="mb-8 w-48 h-10 bg-white/10 rounded-md animate-pulse" />
              <div className="w-24 h-6 bg-white/10 rounded animate-pulse mb-6" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="aspect-video bg-white/5 rounded-md animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        )}
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
    if (type === 'tv') {
      navigate(`/watch/tv/${id}/${newSeason}/1`, { replace: false });
    } else {
      
      
    }
  };

  const handleEpisodeChange = (newEpisode: number) => {
    if (type === 'tv') {
      navigate(`/play/tv/${id}/${activeSeason}/${newEpisode}`, { replace: false });
    } else if (type === 'anime') {
      navigate(`/play/anime/${id}/${newEpisode}`, { replace: false });
    } else {
      
    }
  };

  
  const showBottomSection = ((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 0));

  return (
    <div className={`min-h-screen bg-[#0b0b0b] font-sans text-white relative ${showBottomSection ? 'pb-20' : 'overflow-hidden'}`}>
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
      <div className="w-full relative bg-\[#0b0b0b\] pt-0 lg:pt-0">
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
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 pb-10 pt-2 md:pt-4">
          <div className="mt-2">
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
            
            
            

            {/* Episode Count */}
            <div className="text-white/60 mb-6 font-medium text-lg">
              {seasonData.episodes?.length || 0} Episodes
            </div>

            {/* Episode Grid */}
            <EpisodeList 
              episodes={seasonData.episodes || []} 
              currentEpisode={episode ? parseInt(episode, 10) : undefined}
              onEpisodeSelect={handleEpisodeChange}
              isAnime={type === 'anime'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
