const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

const targetForm = `<form 
          onSubmit={handleSubmit}
          className={\`relative bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 ease-in-out \${isFilterOpen ? 'rounded-2xl' : 'rounded-full'} focus-within:bg-[#252525]/90 focus-within:border-white/30 w-full sm:w-[450px] lg:w-[500px] overflow-hidden hover:shadow-2xl\`}
        >`;

const replacementForm = `<form 
          onSubmit={handleSubmit}
          className="relative bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 ease-out rounded-full focus-within:bg-[#252525]/90 focus-within:border-white/30 w-full sm:w-[450px] lg:w-[500px] hover:shadow-2xl z-20"
        >`;

code = code.replace(targetForm, replacementForm);

const targetDropdown = `          <div className={\`transition-all duration-300 ease-in-out bg-black/20 overflow-hidden \${isFilterOpen ? 'max-h-48 opacity-100 border-t border-white/10' : 'max-h-0 opacity-0 border-t border-transparent'}\`}>
            <div className="px-5 py-4 flex flex-wrap gap-2.5">
              <FilterButton type="all" label="All" />
              <FilterButton type="movies" label="Movies" />
              <FilterButton type="series" label="Series" />
              <FilterButton type="anime" label="Anime" />
            </div>
          </div>
        </form>
      </div>`;

const replacementDropdown = `        </form>
        
        {/* Floating Dropdown Filter Menu */}
        <div 
          className={\`absolute top-full mt-2 right-0 w-full sm:w-[450px] lg:w-[500px] bg-[#1A1A1A]/95 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden transition-all duration-300 origin-top \${isFilterOpen ? 'opacity-100 translate-y-0 scale-y-100 pointer-events-auto' : 'opacity-0 -translate-y-2 scale-y-95 pointer-events-none'}\`}
        >
          <div className="px-5 py-4 flex flex-wrap gap-2.5">
            <FilterButton type="all" label="All" />
            <FilterButton type="movies" label="Movies" />
            <FilterButton type="series" label="Series" />
            <FilterButton type="anime" label="Anime" />
          </div>
        </div>
      </div>`;

code = code.replace(targetDropdown, replacementDropdown);

// Also need to make the parent container of the form relative for absolute positioning of dropdown to work perfectly.
const targetParent = `<div className="pointer-events-auto flex justify-end w-full md:w-auto">`;
const replacementParent = `<div className="pointer-events-auto flex justify-end w-full md:w-auto relative">`;

code = code.replace(targetParent, replacementParent);

fs.writeFileSync('src/components/Navbar.tsx', code);
