const fs = require('fs');
let content = fs.readFileSync('src/components/SeasonSelector.tsx', 'utf8');

content = content.replace(
`  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white px-5 py-3 rounded-md font-bold text-lg transition-colors border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {/* Mocking the little bag icon from reference conceptually with just clean text */}
        <span>{displayName}</span>
        <ChevronDown size={20} className={\`transition-transform duration-200 \${isOpen ? 'rotate-180' : ''}\`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 max-h-96 overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-md shadow-2xl z-50 py-2">
          {seasons.map((season) => (
            <button
              key={season.id}
              onClick={() => handleSelect(season.season_number)}
              className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-white/10 transition-colors"
            >
              <span className={\`font-medium \${season.season_number === currentSeason ? 'text-white' : 'text-white/70'}\`}>
                {season.name}
              </span>
              {season.season_number === currentSeason && (
                <Check size={18} className="text-white" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );`,
`  return (
    <div className="relative inline-block z-[100]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md text-white px-5 py-2.5 rounded-full font-semibold text-base transition-all hover:bg-[#252525]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <span>{displayName}</span>
        <ChevronDown size={20} className={\`transition-transform duration-200 \${isOpen ? 'rotate-180' : ''}\`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-3 w-72 max-h-80 overflow-y-auto bg-[#141414]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8),_0_0_20px_rgba(255,255,255,0.05)] z-[100] py-2">
          {seasons.map((season) => (
            <button
              key={season.id}
              onClick={() => handleSelect(season.season_number)}
              className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-white/10 transition-colors group"
            >
              <span className={\`font-medium \${season.season_number === currentSeason ? 'text-white' : 'text-white/60 group-hover:text-white/90'}\`}>
                {season.name}
              </span>
              {season.season_number === currentSeason && (
                <Check size={18} className="text-white" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );`);

fs.writeFileSync('src/components/SeasonSelector.tsx', content, 'utf8');
