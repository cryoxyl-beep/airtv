const fs = require('fs');
let content = fs.readFileSync('src/components/EpisodeList.tsx', 'utf8');

content = content.replace(
`interface EpisodeListProps {
  episodes: any[];
  currentEpisode: number;
  onEpisodeSelect: (episodeNumber: number) => void;
}`,
`interface EpisodeListProps {
  episodes: any[];
  currentEpisode: number;
  onEpisodeSelect: (episodeNumber: number) => void;
  isAnime?: boolean;
}`);

content = content.replace(
`            {/* Content Info */}
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-base text-white/90 group-hover:text-white transition-colors truncate">
                {episode.episode_number}. {episode.name}
              </h3>
              
              <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                {episode.overview || "No description available."}
              </p>
              
              {/* Metadata row */}
              <div className="flex items-center gap-3 mt-1 text-xs text-white/40 font-medium">
                {/* Mock rating */}
                <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">U/A 16+</span>
                
                {episode.runtime && (
                  <span className="flex items-center gap-1">
                    {episode.runtime}min
                  </span>
                )}
                
                {episode.air_date && (
                  <span>
                    {new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>`,
`            {/* Content Info */}
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-base text-white/90 group-hover:text-white transition-colors truncate">
                {episode.episode_number}. {episode.name}
              </h3>
              
              {!isAnime && (
                <>
                  <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                    {episode.overview || "No description available."}
                  </p>
                  
                  {/* Metadata row */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/40 font-medium">
                    {/* Mock rating */}
                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">U/A 16+</span>
                    
                    {episode.runtime && (
                      <span className="flex items-center gap-1">
                        {episode.runtime}min
                      </span>
                    )}
                    
                    {episode.air_date && (
                      <span>
                        {new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>`);

fs.writeFileSync('src/components/EpisodeList.tsx', content, 'utf8');
