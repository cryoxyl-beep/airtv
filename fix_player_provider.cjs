const fs = require('fs');
let code = fs.readFileSync('src/pages/PlayerPage.tsx', 'utf-8');

// 1. Add Provider type import
code = code.replace(
  "import { buildMovieProviderUrl, buildSeriesProviderUrl, buildAnimeProviderUrl } from '../utils/providers';",
  "import { buildMovieProviderUrl, buildSeriesProviderUrl, buildAnimeProviderUrl, Provider } from '../utils/providers';"
);

// 2. Add provider state
if (!code.includes('const [provider, setProvider] = useState<Provider>')) {
  code = code.replace(
    /const \[showEpisodeOverlay, setShowEpisodeOverlay\] = useState\(false\);/,
    "const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);\n  const [provider, setProvider] = useState<Provider>('vidnest');"
  );
}

// 3. Update providerUrl logic
const targetUrlLogic = `  let providerUrl: string | null = null;
  if (data && id) {
    if (type === 'movie') {
      providerUrl = buildMovieProviderUrl('vidnest', id);
    } else if (type === 'tv') {
      providerUrl = buildSeriesProviderUrl('vidnest', id, activeSeason || 1, activeEpisode);
    } else if (type === 'anime') {
      const malId = data.fribb_mapping?.malId || data.mal_id || data.idmal || data.id_mal;
      providerUrl = buildAnimeProviderUrl('vidnest', id, malId, activeEpisode, 'sub');
    }
  }`;

const replacementUrlLogic = `  let providerUrl: string | null = null;
  if (data && id) {
    if (type === 'movie') {
      providerUrl = buildMovieProviderUrl(provider, id);
    } else if (type === 'tv') {
      providerUrl = buildSeriesProviderUrl(provider, id, activeSeason || 1, activeEpisode);
    } else if (type === 'anime') {
      const malId = data.fribb_mapping?.malId || data.mal_id || data.idmal || data.id_mal;
      providerUrl = buildAnimeProviderUrl(provider, id, malId, activeEpisode, 'sub');
    }
  }`;
code = code.replace(targetUrlLogic, replacementUrlLogic);

// 4. Update the render for the top bar
const targetTopBar = `        {showEpisodesButton && (
          <button
            onClick={() => setShowEpisodeOverlay(!showEpisodeOverlay)}
            className="pointer-events-auto w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
            aria-label="Episodes"
          >
            <ListVideo className="w-5 h-5 text-white" />
          </button>
        )}
      </div>`;

const replacementTopBar = `        <div className="flex items-center gap-4">
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
      </div>`;

code = code.replace(targetTopBar, replacementTopBar);

fs.writeFileSync('src/pages/PlayerPage.tsx', code);
