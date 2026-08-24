const fs = require('fs');
let content = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');

const inputTarget = `<div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/50" />
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search movies, tv, and anime..."
              className="w-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md rounded-full py-4 pl-16 pr-12 text-xl text-white outline-none focus:border-white/30 focus:bg-[#252525]/90 transition-all"
              autoFocus
            />
            {inputValue && (
              <button 
                onClick={() => setInputValue('')}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>`;

const inputReplacement = `<div className="relative group">
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
          </div>`;

content = content.replace(inputTarget, inputReplacement);

const gridTarget = `<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 gap-y-8">
            {results.map((item, index) => (
               <div key={item.id + '-' + index} className="w-full">
                  <RowCard item={item} index={index} isGridCard={true} />
               </div>
            ))}
          </div>`;

const gridReplacement = `<div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8">
            {results.map((item, index) => (
               <div key={item.id + '-' + index} className="flex-shrink-0">
                  <RowCard item={item} index={index} />
               </div>
            ))}
          </div>`;

content = content.replace(gridTarget, gridReplacement);

const skeletonTarget = `<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 gap-y-8">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-video bg-white/5 rounded-md animate-pulse" />
            ))}
          </div>`;

const skeletonReplacement = `<div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-[300px] md:w-[400px] lg:w-[450px] aspect-video bg-white/5 rounded-md animate-pulse" />
            ))}
          </div>`;

content = content.replace(skeletonTarget, skeletonReplacement);

fs.writeFileSync('src/pages/SearchPage.tsx', content, 'utf8');
