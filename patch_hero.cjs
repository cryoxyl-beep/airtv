const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/Hero.tsx', 'utf8');

const targetStr = '<div className="relative w-full min-h-[95vh] overflow-hidden bg-[#0b0b0b] flex flex-col justify-end pb-12 pt-32">';

const newCode = `${targetStr}
      {/* Search Button (Top Right) */}
      <div className="absolute top-6 right-8 md:top-8 md:right-12 z-50 pointer-events-auto">
        <button 
          className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"
          aria-label="Search"
        >
          <Search className="w-5 h-5 text-white/90 group-hover:scale-105 transition-transform" strokeWidth={2.5} />
        </button>
      </div>`;

code = code.replace(targetStr, newCode);
fs.writeFileSync('/app/applet/src/components/Hero.tsx', code);
console.log("Patched Hero search button");
