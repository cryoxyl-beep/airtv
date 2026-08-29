const fs = require('fs');
let code = fs.readFileSync('src/components/EpisodeOverlay.tsx', 'utf-8');

const target = `              {type === 'tv' && data.seasons && (
                <div className="w-fit">
                  <SeasonSelector 
                    seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                    currentSeason={currentSeason}
                    onSeasonChange={onSeasonChange}
                  />
                </div>
              )}`;

const replacement = `              {type === 'tv' && data.seasons && (
                <div className="w-fit">
                  <SeasonSelector 
                    seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                    currentSeason={currentSeason}
                    onSeasonChange={onSeasonChange}
                  />
                </div>
              )}
              
              {type === 'anime' && data.animeGroup?.seasons && data.animeGroup.seasons.length > 0 && (
                <div className="w-fit">
                  <SeasonSelector 
                    seasons={data.animeGroup.seasons} 
                    currentSeason={parseInt(id!)}
                    onSeasonChange={onSeasonChange}
                  />
                </div>
              )}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/EpisodeOverlay.tsx', code);
