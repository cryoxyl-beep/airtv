const fs = require('fs');

// Patch SearchPage.tsx
let searchPage = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');
searchPage = searchPage.replace(
  'className="p-3 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition-all group border border-white/10"',
  'className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"'
);
fs.writeFileSync('src/pages/SearchPage.tsx', searchPage, 'utf8');

// Patch Navbar.tsx
let navbar = fs.readFileSync('src/components/Navbar.tsx', 'utf8');
navbar = navbar.replace(
  '<button\n                type="button"\n                onClick={() => setIsFilterOpen(!isFilterOpen)}\n                className={`flex items-center justify-center h-8 md:h-9 px-3 md:px-4 rounded-full text-xs md:text-sm font-medium transition-colors border ${isFilterOpen ? \'bg-white text-black border-white\' : \'bg-[#1A1A1A] border-white/20 text-white hover:bg-white/10 hover:text-white shadow-sm\'}`}\n              >\n                <SlidersHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />\n                <span className="hidden sm:inline">Filter</span>\n              </button>',
  '<button\n                type="button"\n                onClick={() => setIsFilterOpen(!isFilterOpen)}\n                className={`flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full text-xs md:text-sm font-medium transition-colors border ${isFilterOpen ? \'bg-white text-black border-white\' : \'bg-[#1A1A1A] border-white/20 text-white hover:bg-white/10 hover:text-white shadow-sm\'}`}\n              >\n                <SlidersHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4" />\n              </button>'
);
fs.writeFileSync('src/components/Navbar.tsx', navbar, 'utf8');
