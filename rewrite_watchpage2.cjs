const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

const target = `{type === 'tv' && data.seasons && (
              <div className="mb-8">
                <SeasonSelector 
                  seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                  currentSeason={activeSeason}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}`;
            
const replacement = `{type === 'tv' && data.seasons && (
              <div className="mb-8">
                <SeasonSelector 
                  seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                  currentSeason={activeSeason}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}
            {type === 'anime' && data.animeGroup && data.animeGroup.seasons && data.animeGroup.seasons.length > 1 && (
              <div className="mb-8 flex flex-col gap-2">
                <SeasonSelector 
                  seasons={data.animeGroup.seasons.map((s: any) => ({
                    id: s.anilistId,
                    season_number: s.anilistId,
                    name: s.title
                  }))} 
                  currentSeason={parseInt(id || "0")}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}`;

code = code.replace(target, replacement);

const targetShowBottom = "const showBottomSection = ((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 1));";
const replacementShowBottom = "const showBottomSection = ((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 0));";
code = code.replace(targetShowBottom, replacementShowBottom);

fs.writeFileSync('src/pages/WatchPage.tsx', code);
