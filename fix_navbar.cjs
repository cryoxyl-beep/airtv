const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

code = code.replace(
  "type FilterType = 'all' | 'movies' | 'series' | 'anime';",
  "type FilterType = '' | 'all' | 'movies' | 'series' | 'anime';"
);

code = code.replace(
  "const [filter, setFilter] = useState<FilterType>('all');",
  "const [filter, setFilter] = useState<FilterType>('');\n  const [showFilterError, setShowFilterError] = useState(false);"
);

code = code.replace(
  "setFilter((searchParams.get('filter') as FilterType) || 'all');",
  "setFilter((searchParams.get('filter') as FilterType) || '');"
);

const oldHandleSubmit = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setIsFilterOpen(false);
      navigate(\`/search?q=\${encodeURIComponent(inputValue.trim())}&filter=\${filter}\`);
    }
  };`;

const newHandleSubmit = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      if (!filter) {
        setIsFilterOpen(true);
        setShowFilterError(true);
        setTimeout(() => setShowFilterError(false), 2000);
        return;
      }
      setIsFilterOpen(false);
      setShowFilterError(false);
      navigate(\`/search?q=\${encodeURIComponent(inputValue.trim())}&filter=\${filter}\`);
    }
  };`;

code = code.replace(oldHandleSubmit, newHandleSubmit);

const oldFilterButton = `  const FilterButton = ({ type, label }: { type: FilterType, label: string }) => (
    <button
      type="button"
      onClick={() => setFilter(type)}
      className={\`px-5 py-2 rounded-full text-sm font-medium transition-all \${
        filter === type 
          ? 'bg-white text-black' 
          : 'bg-[#1A1A1A] border border-white/20 text-white hover:bg-white/10'
      }\`}
    >
      {label}
    </button>
  );`;

const newFilterButton = `  const FilterButton = ({ type, label }: { type: FilterType, label: string }) => (
    <button
      type="button"
      onClick={() => {
        setFilter(type);
        setShowFilterError(false);
      }}
      className={\`px-5 py-2 rounded-full text-sm font-medium transition-all \${
        filter === type 
          ? 'bg-white text-black' 
          : showFilterError
            ? 'bg-[#1A1A1A] border border-red-500/50 text-red-400 hover:bg-red-500/10'
            : 'bg-[#1A1A1A] border border-white/20 text-white hover:bg-white/10'
      }\`}
    >
      {label}
    </button>
  );`;

code = code.replace(oldFilterButton, newFilterButton);

fs.writeFileSync('src/components/Navbar.tsx', code);
