const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

// Add isExpanded state
code = code.replace(
  "const [inputValue, setInputValue] = useState('');",
  "const [isExpanded, setIsExpanded] = useState(false);\n  const [inputValue, setInputValue] = useState('');"
);

// Update route effect to expand search
code = code.replace(
  "setInputValue(searchParams.get('q') || '');",
  "const q = searchParams.get('q') || '';\n      setInputValue(q);\n      if (q) setIsExpanded(true);"
);

// Update focus search event to expand
code = code.replace(
  "const handleFocusSearch = () => {",
  "const handleFocusSearch = () => {\n      setIsExpanded(true);"
);

// Add click outside listener
const clickOutsideHook = `  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const container = document.getElementById('search-form-container');
      if (container && !container.contains(e.target as Node)) {
        if (!inputValue) {
          setIsExpanded(false);
        }
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue]);

  const isSearchActive = isExpanded || inputValue || isFilterOpen || location.pathname === '/search';
`;

code = code.replace(
  "const isImmersive = location.pathname.startsWith",
  clickOutsideHook + "\n  const isImmersive = location.pathname.startsWith"
);

// Form and container
const formTarget = `<div className="pointer-events-auto flex justify-end w-full md:w-auto relative">
        <form 
          onSubmit={handleSubmit}
          className="relative bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 ease-out rounded-full focus-within:bg-[#252525]/90 focus-within:border-white/30 w-full sm:w-[450px] lg:w-[500px] hover:shadow-2xl z-20"
        >`;

const formReplacement = `<div id="search-form-container" className="pointer-events-auto flex justify-end w-full md:w-auto relative">
        <form 
          onSubmit={handleSubmit}
          className={\`relative bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 ease-out rounded-full focus-within:bg-[#252525]/90 focus-within:border-white/30 \${isSearchActive ? 'w-full sm:w-[450px] lg:w-[500px]' : 'w-[90px] md:w-[150px]'} hover:shadow-2xl z-20\`}
        >`;

code = code.replace(formTarget, formReplacement);

// Input and Search Icon
const inputTarget = `<div className="relative flex items-center h-12 md:h-14">
            <Search className="absolute left-5 w-5 h-5 text-white/50 pointer-events-none" />
            <input 
              type="text"
              name="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search..."
              className="w-full h-full bg-transparent pl-14 pr-[160px] md:pr-[200px] text-base text-white outline-none placeholder:text-white/50 cursor-text"
              autoComplete="off"
            />`;

const inputReplacement = `<div className="relative flex items-center h-12 md:h-14">
            <button 
              type="button"
              onClick={() => {
                if (!isSearchActive) {
                  setIsExpanded(true);
                  setTimeout(() => {
                    const input = document.querySelector('input[name="search"]');
                    if (input) (input as HTMLElement).focus();
                  }, 50);
                }
              }}
              className={\`absolute left-5 w-5 h-5 flex items-center justify-center text-white/50 transition-colors z-30 \${!isSearchActive ? 'cursor-pointer hover:text-white pointer-events-auto' : 'pointer-events-none'}\`}
            >
              <Search className="w-full h-full" />
            </button>
            <input 
              type="text"
              name="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              placeholder="Search..."
              className={\`h-full bg-transparent text-base text-white outline-none placeholder:text-white/50 cursor-text transition-all duration-300 \${isSearchActive ? 'w-full pl-14 pr-[160px] md:pr-[200px] opacity-100 pointer-events-auto' : 'w-0 pl-14 pr-0 opacity-0 pointer-events-none'}\`}
              autoComplete="off"
            />`;

code = code.replace(inputTarget, inputReplacement);

fs.writeFileSync('src/components/Navbar.tsx', code);
