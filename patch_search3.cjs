const fs = require('fs');
let content = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');

// Imports update
content = content.replace(
  "import { Search, X } from 'lucide-react';",
  "import { Search, X, SlidersHorizontal } from 'lucide-react';"
);

// State update
content = content.replace(
  "const [inputValue, setInputValue] = useState(query);",
  "const [inputValue, setInputValue] = useState(query);\n  const [isFilterOpen, setIsFilterOpen] = useState(false);"
);

// Container update
content = content.replace(
  '<div className="max-w-7xl mx-auto">',
  '<div className="max-w-[1450px] mx-auto">'
);

// Header replacement
const headerTarget = `<div className="flex flex-col gap-8 mb-12">
          
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/50" />
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search movies, tv, and anime..."
              className="w-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md rounded-full py-4 pl-16 pr-24 text-xl text-white outline-none focus:border-white/30 focus:bg-[#252525]/90 transition-all"
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {inputValue && (
                <button 
                  onClick={() => setInputValue('')}
                  className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <div className="hidden md:flex items-center justify-center h-7 px-2 rounded bg-white/10 text-sm font-semibold text-white/50 border border-white/10 select-none pointer-events-none">
                <span className="mr-0.5 text-[13px] leading-none">⌘</span>K
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            <FilterButton type="all" label="All" />
            <FilterButton type="movies" label="Movies" />
            <FilterButton type="series" label="Series" />
            <FilterButton type="anime" label="Anime" />
          </div>
        </div>`;

const headerReplacement = `<div className="flex flex-col mb-12">
          <div className={\`relative w-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 ease-in-out \${isFilterOpen ? 'rounded-2xl' : 'rounded-full'} focus-within:bg-[#252525]/90 focus-within:border-white/30 overflow-hidden\`}>
            <div className="relative flex items-center h-[64px]">
              <Search className="absolute left-6 w-6 h-6 text-white/50 pointer-events-none" />
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search movies, tv, and anime..."
                className="w-full h-full bg-transparent pl-16 pr-[220px] text-xl text-white outline-none"
                autoFocus
              />
              <div className="absolute right-3 flex items-center gap-2">
                {inputValue && (
                  <button 
                    onClick={() => setInputValue('')}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={\`flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium transition-colors border \${isFilterOpen ? 'bg-white text-black border-white' : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20 hover:text-white'}\`}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filter
                </button>
                <div className="hidden md:flex items-center justify-center h-8 px-2.5 rounded bg-white/10 text-sm font-semibold text-white/50 border border-white/10 select-none pointer-events-none">
                  <span className="mr-0.5 text-[13px] leading-none">⌘</span>K
                </div>
              </div>
            </div>

            <div className={\`transition-all duration-300 ease-in-out overflow-hidden bg-black/20 \${isFilterOpen ? 'max-h-32 opacity-100 border-t border-white/10' : 'max-h-0 opacity-0'}\`}>
              <div className="px-6 py-4 flex flex-wrap gap-3">
                <FilterButton type="all" label="All" />
                <FilterButton type="movies" label="Movies" />
                <FilterButton type="series" label="Series" />
                <FilterButton type="anime" label="Anime" />
              </div>
            </div>
          </div>
        </div>`;

content = content.replace(headerTarget, headerReplacement);
fs.writeFileSync('src/pages/SearchPage.tsx', content, 'utf8');
