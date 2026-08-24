const fs = require('fs');

let navbar = fs.readFileSync('/app/applet/src/components/Navbar.tsx', 'utf8');

navbar = navbar.replace(
  'placeholder="Search movies, tv, and anime..."',
  'placeholder="Search..."'
);

navbar = navbar.replace(
  '<button\n                type="button"\n                onClick={() => setIsFilterOpen(!isFilterOpen)}\n                className={`flex items-center justify-center h-8 md:h-9 px-3 md:px-4 rounded-full text-xs md:text-sm font-medium transition-colors border ${isFilterOpen ? \'bg-white text-black border-white\' : \'bg-white/10 text-white/70 border-white/10 hover:bg-white/20 hover:text-white\'}`}',
  '<button\n                type="button"\n                onClick={() => setIsFilterOpen(!isFilterOpen)}\n                className={`flex items-center justify-center h-8 md:h-9 px-3 md:px-4 rounded-full text-xs md:text-sm font-medium transition-colors border ${isFilterOpen ? \'bg-white text-black border-white\' : \'bg-[#1A1A1A] border-white/20 text-white hover:bg-white/10 hover:text-white shadow-sm\'}`}'
);

navbar = navbar.replace(
  '<div className="hidden md:flex items-center justify-center h-8 px-2.5 rounded bg-white/10 text-xs font-semibold text-white/50 border border-white/10 select-none pointer-events-none">',
  '<div className="hidden md:flex items-center justify-center h-8 px-2.5 rounded-full bg-[#1A1A1A] text-xs font-semibold text-white/60 border border-white/20 select-none pointer-events-none shadow-sm">'
);

navbar = navbar.replace(
  '<div className={`transition-all duration-300 ease-in-out overflow-hidden bg-black/20 ${isFilterOpen ? \'max-h-32 opacity-100 border-t border-white/10\' : \'max-h-0 opacity-0\'}`}>\n            <div className="px-5 py-4 flex flex-wrap gap-2.5">',
  '<div className={`grid transition-[grid-template-rows,opacity,border-color] duration-300 ease-in-out bg-black/20 ${isFilterOpen ? \'grid-rows-[1fr] opacity-100 border-t border-white/10\' : \'grid-rows-[0fr] opacity-0 border-t border-transparent\'}`}>\n            <div className="overflow-hidden">\n              <div className="px-5 py-4 flex flex-wrap gap-2.5">'
);

navbar = navbar.replace(
  '              <FilterButton type="anime" label="Anime" />\n            </div>\n          </div>\n        </form>',
  '              <FilterButton type="anime" label="Anime" />\n              </div>\n            </div>\n          </div>\n        </form>'
);

fs.writeFileSync('/app/applet/src/components/Navbar.tsx', navbar, 'utf8');

let searchPage = fs.readFileSync('/app/applet/src/pages/SearchPage.tsx', 'utf8');

searchPage = searchPage.replace(
  '<div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8">\n            {[...Array(6)].map((_, i) => (\n              <div key={i} className="w-[300px] md:w-[400px] lg:w-[450px] aspect-video bg-white/5 rounded-md animate-pulse" />\n            ))}\n          </div>',
  '<div className="flex flex-wrap justify-center gap-4 sm:gap-6 mx-auto w-full max-w-[1450px]">\n            {[...Array(6)].map((_, i) => (\n              <div key={i} className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)] max-w-[450px] aspect-video bg-white/5 rounded-md animate-pulse flex-shrink-0" />\n            ))}\n          </div>'
);

searchPage = searchPage.replace(
  '<div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8 max-w-[1450px] mx-auto">\n            {results.map((item, index) => (\n               <div key={item.id + \'-\' + index} className="flex-shrink-0">\n                  <RowCard item={item} index={index} />\n               </div>\n            ))}\n          </div>',
  '<div className="flex flex-wrap justify-center gap-4 sm:gap-6 mx-auto w-full max-w-[1450px]">\n            {results.map((item, index) => (\n               <div key={item.id + \'-\' + index} className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)] max-w-[450px] flex-shrink-0">\n                  <RowCard item={item} index={index} isGridCard={true} />\n               </div>\n            ))}\n          </div>'
);

fs.writeFileSync('/app/applet/src/pages/SearchPage.tsx', searchPage, 'utf8');
