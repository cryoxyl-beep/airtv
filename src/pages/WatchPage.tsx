import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAnimeDetails } from '../api/anilist';
import { groupCache } from '../api/anilistGroups';
import { fetchDetails, fetchTVSeason, fetchTrailer, IMAGE_BASE_URL } from '../api/tmdb';
import WatchPlayer from '../components/WatchPlayer';
import SeasonSelector from '../components/SeasonSelector';
import EpisodeList from '../components/EpisodeList';
import { ArrowLeft } from 'lucide-react';
import WatchPlayerSkeleton from '../components/WatchPlayerSkeleton';

interface WatchPageProps {
  type: 'movie' | 'tv' | 'anime';
}

export default function WatchPage({ type }: WatchPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(false);
      try {
        if (!id) throw new Error('No ID');
        
        let details;
        try {
          if (type === 'anime') {
            details = await fetchAnimeDetails(parseInt(id));
            if (details) {
              details.source = 'anilist';
              details.media_type = 'anime';
              details.animeGroup = groupCache.get(parseInt(id));
            }
          } else {
            details = await fetchDetails(parseInt(id), type);
          }
        } catch (e: any) {
          console.error("fetchDetails failed:", e);
          throw new Error(`Details fetch failed: ${e.message}`);
        }
        
        setData(details);

        // 2. If TV show, fetch specific season details
        if (type === 'anime') {
          // Construct base episodes from AniList count
          // Construct base episodes from AniList count
          const numEpisodes = details.number_of_episodes || 1;
          const streamingEps = details.anilist_raw?.streamingEpisodes || [];
          
          const anilistEpisodes = Array.from({ length: numEpisodes }, (_, i) => {
            const epNum = i + 1;
            // Try to find a matching streaming episode to extract the title
            // Usually titles are like "Episode 1 - Title" or "1 - Title"
            let epName = `Episode ${epNum}`;
            let epThumb = null;
            
            const match = streamingEps.find((se: any) => {
              return se.title?.includes(`Episode ${epNum}`) || se.title?.startsWith(`${epNum} -`);
            });
            
            if (match) {
              const parts = match.title.split('-');
              if (parts.length > 1) {
                epName = parts.slice(1).join('-').trim();
              } else {
                epName = match.title;
              }
              epThumb = match.thumbnail;
            }
            
            return {
              episode_number: epNum,
              name: epName,
              overview: '',
              still_path: epThumb
            };
          });
          
          let mergedEpisodes = [...anilistEpisodes];
          
          if (details.tmdb_id && details.tmdb_type !== 'movie') {
            try {
              // Fribb gives us the exact TMDB season mapping
              const targetSeason = details.tmdb_season || 1;
              const tmdbSeasonData = await fetchTVSeason(details.tmdb_id, targetSeason);
              
              if (tmdbSeasonData && tmdbSeasonData.episodes) {
                // Merge ONLY TMDB thumbnails into our AniList episodes
                mergedEpisodes = mergedEpisodes.map(ep => {
                  const tmdbEp = tmdbSeasonData.episodes.find((t: any) => t.episode_number === ep.episode_number);
                  return {
                    ...ep,
                    still_path: tmdbEp?.still_path || ep.still_path
                  };
                });
              }
            } catch (e) {
              console.warn("Failed to fetch TMDB season data for anime", e);
            }
          }
          
          setSeasonData({ episodes: mergedEpisodes });
          // Force seasonNumber to 1 to hide season selector logic if it's based on it
          setSeasonNumber(1);
          
        } else if (type === 'tv') {
          // Check if requested season exists
          const seasons = details.seasons || [];
          let targetSeason = seasonNumber;
          const seasonExists = seasons.find((s: any) => s.season_number === targetSeason);
          
          if (!seasonExists && seasons.length > 0) {
            // Default to the first valid season (prefer > 0)
            const validSeason = seasons.find((s: any) => s.season_number > 0) || seasons[0];
            targetSeason = validSeason.season_number;
            setSeasonNumber(targetSeason);
            setEpisodeNumber(1);
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
        setLoading(false);
      }
    };

    loadContent();
  }, [id, type]);

  // Load season data when seasonNumber state changes, but don't reload everything
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

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#0b0b0b] font-sans text-white ${(type === 'tv' || type === 'anime') ? 'pb-20' : 'overflow-hidden'}`}>
        {/* Top Nav Placeholder */}
        <div className="absolute top-0 left-0 p-6 z-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse" />
        </div>

        {/* Player Skeleton */}
        <div className="w-full relative bg-black pt-0 lg:pt-0">
          <WatchPlayerSkeleton type={type === 'anime' ? 'tv' : type} />
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
    setSeasonNumber(newSeason);
    setEpisodeNumber(1);
  };

  const handleEpisodeChange = (newEpisode: number) => {
    setEpisodeNumber(newEpisode);
  };

  const showBottomSection = ((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 1) || (type === 'anime' && data?.animeGroup && data.animeGroup.seasons && data.animeGroup.seasons.length > 1));

  return (
    <div className={`min-h-screen bg-[#0b0b0b] font-sans text-white ${showBottomSection ? 'pb-20' : 'overflow-hidden'}`}>
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
        <WatchPlayer 
          item={data} 
          type={type} 
          seasonNumber={(type === 'tv' || type === 'anime') ? seasonNumber : undefined}
          episodeNumber={(type === 'tv' || type === 'anime') ? episodeNumber : undefined}
          seasonData={(type === 'tv' || type === 'anime') ? seasonData : undefined}
          forceFullScreen={!showBottomSection}
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
                  currentSeason={seasonNumber}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}
            
            {type === 'anime' && data.animeGroup && data.animeGroup.seasons && data.animeGroup.seasons.length > 1 && (
              <div className="mb-8 flex flex-col gap-2">
                
                <div>
                  <SeasonSelector 
                    seasons={data.animeGroup.seasons.map((s: any) => ({
                      id: s.anilistId,
                      season_number: s.anilistId,
                      name: s.displayTitle
                    }))} 
                    currentSeason={parseInt(id || "0")}
                    onSeasonChange={(newId) => {
                       navigate(`/anime/${newId}`, { replace: true });
                    }}
                  />
                </div>
              </div>
            )}

            {/* Episode Count */}
            <div className="text-white/60 mb-6 font-medium text-lg">
              {seasonData.episodes?.length || 0} Episodes
            </div>

            {/* Episode Grid */}
            <EpisodeList 
              episodes={seasonData.episodes || []} 
              currentEpisode={episodeNumber}
              onEpisodeSelect={handleEpisodeChange}
              isAnime={type === 'anime'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
