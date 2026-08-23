const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

// 1. Inject groupCache import
content = content.replace(/import \{ fetchAnimeDetails \} from '\.\.\/api\/anilist';/, 
  "import { fetchAnimeDetails } from '../api/anilist';\nimport { groupCache } from '../api/anilistGroups';");

// 2. Attach animeGroup to details
content = content.replace(/details\.media_type = 'anime';\n\s*\}\n\s*\} else \{/, 
  "details.media_type = 'anime';\n              details.animeGroup = groupCache.get(parseInt(id));\n            }\n          } else {");

// 3. Add Anime Season Selector in UI
const seasonSelectorBlock = `{type === 'tv' && data.seasons && (
              <div className="mb-8">
                <SeasonSelector 
                  seasons={data.seasons.filter((s: any) => s.season_number > 0)} 
                  currentSeason={seasonNumber}
                  onSeasonChange={handleSeasonChange}
                />
              </div>
            )}
            
            {type === 'anime' && data.animeGroup && data.animeGroup.seasons.length > 1 && (
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

content = content.replace(/\{type === 'tv' && data\.seasons && \([\s\S]*?\}\)/, seasonSelectorBlock);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');
