const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const target = `{type === 'tv' && data.seasons && (
              <div className="mb-8">
                <SeasonSelector 
                  seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                  currentSeason={seasonNumber}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}`;

const replacement = `{type === 'tv' && data.seasons && (
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
                <h2 className="text-white/60 text-sm font-semibold uppercase tracking-wider">{data.animeGroup.title}</h2>
                <div>
                  <SeasonSelector 
                    seasons={data.animeGroup.seasons.map((s: any) => ({
                      id: s.anilistId,
                      season_number: s.anilistId,
                      name: s.displayTitle
                    }))} 
                    currentSeason={parseInt(id || "0")}
                    onSeasonChange={(newId) => {
                       navigate(\`/anime/\${newId}\`, { replace: true });
                    }}
                  />
                </div>
              </div>
            )}`;

content = content.replace(target, replacement);
fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
