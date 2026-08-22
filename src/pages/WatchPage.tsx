import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchDetails, fetchTVSeason, fetchTrailer, IMAGE_BASE_URL } from '../api/tmdb';
import WatchPlayer from '../components/WatchPlayer';
import SeasonSelector from '../components/SeasonSelector';
import EpisodeList from '../components/EpisodeList';
import { ArrowLeft } from 'lucide-react';

interface WatchPageProps {
  type: 'movie' | 'tv';
}

export default function WatchPage({ type }: WatchPageProps) {
  const { id, season: seasonParam, episode: episodeParam } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState<any>(null);
  const [seasonData, setSeasonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const seasonNumber = parseInt(seasonParam || '1', 10);
  const episodeNumber = parseInt(episodeParam || '1', 10);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(false);
      window.scrollTo(0, 0); // Reset scroll on load/navigation
      try {
        if (!id) throw new Error('No ID');
        
        // 1. Fetch main details (movie or tv show)
        const details = await fetchDetails(parseInt(id), type);
        setData(details);

        // 2. If TV show, fetch specific season details
        if (type === 'tv') {
          // If no season param, we might redirect to season 1 episode 1 (handled in router usually)
          // But here we definitely have it if it matched the route
          const season = await fetchTVSeason(parseInt(id), seasonNumber);
          setSeasonData(season);
        }
      } catch (err) {
        console.error("Failed to load watch data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [id, type, seasonNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
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
    // If they navigated directly here, navigate(-1) might exit app.
    // We can just go back, or fallback to home.
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleSeasonChange = (newSeason: number) => {
    // Navigate to episode 1 of the new season
    navigate(`/watch/tv/${id}/season/${newSeason}/episode/1`);
  };

  const handleEpisodeChange = (newEpisode: number) => {
    navigate(`/watch/tv/${id}/season/${seasonNumber}/episode/${newEpisode}`);
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] font-sans text-white pb-20">
      {/* Top Nav (Minimal) */}
      <div className="absolute top-0 left-0 w-full p-6 z-50 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent">
        <button 
          onClick={handleBack}
          className="p-3 bg-black/40 hover:bg-white/10 rounded-full backdrop-blur-md transition-all group"
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
          seasonNumber={type === 'tv' ? seasonNumber : undefined}
          episodeNumber={type === 'tv' ? episodeNumber : undefined}
          seasonData={type === 'tv' ? seasonData : undefined}
        />
      </div>

      {/* Details & Episode Selection Area */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-10 mt-4 md:mt-8">
        
        {/* Title & Metadata (Movie Focus, or brief TV info) */}
        <div className="flex flex-col gap-4 max-w-4xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {data.title || data.name}
          </h1>
          
          <div className="flex items-center gap-4 text-sm md:text-base text-white/60 font-medium">
            {type === 'movie' && (
              <>
                <span>{new Date(data.release_date).getFullYear()}</span>
                {data.runtime && <span>{Math.floor(data.runtime / 60)}h {data.runtime % 60}m</span>}
              </>
            )}
            {type === 'tv' && (
              <>
                <span>{new Date(data.first_air_date).getFullYear()}</span>
                <span>{data.number_of_seasons} Season{data.number_of_seasons > 1 ? 's' : ''}</span>
              </>
            )}
            <div className="flex items-center gap-2">
              {data.genres?.slice(0, 3).map((g: any, i: number) => (
                <span key={g.id}>
                  {g.name}
                  {i < Math.min(data.genres.length, 3) - 1 ? ' • ' : ''}
                </span>
              ))}
            </div>
          </div>
          
          <p className="text-lg text-white/80 leading-relaxed max-w-3xl">
            {type === 'tv' && seasonData?.episodes?.find((e: any) => e.episode_number === episodeNumber)?.overview 
              ? seasonData.episodes.find((e: any) => e.episode_number === episodeNumber).overview 
              : data.overview}
          </p>
        </div>

        {/* TV specific sections */}
        {type === 'tv' && data.seasons && seasonData && (
          <div className="mt-10">
            {/* Season Selector */}
            <div className="mb-8">
              <SeasonSelector 
                seasons={data.seasons.filter((s: any) => s.season_number > 0)} // exclude specials usually
                currentSeason={seasonNumber}
                onSeasonChange={handleSeasonChange}
              />
            </div>
            
            {/* Tabs Mock */}
            <div className="flex gap-8 border-b border-white/10 mb-8 pb-4 text-lg font-medium">
              <button className="text-white relative after:absolute after:-bottom-[17px] after:left-0 after:w-full after:h-1 after:bg-white">
                Episodes
              </button>
              <button className="text-white/40 hover:text-white transition-colors">
                Related
              </button>
              <button className="text-white/40 hover:text-white transition-colors">
                Details
              </button>
            </div>

            {/* Episode Count */}
            <div className="text-white/60 mb-6">
              {seasonData.episodes?.length || 0} episodes
            </div>

            {/* Episode Grid */}
            <EpisodeList 
              episodes={seasonData.episodes || []} 
              currentEpisode={episodeNumber}
              onEpisodeSelect={handleEpisodeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
