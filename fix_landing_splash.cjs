const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

const oldState = `export default function Landing() {
  const navigate = useNavigate();`;

const newState = `export default function Landing() {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Quick 1-second splash for the landing page without data waiting
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);`;

code = code.replace(oldState, newState);

const oldReturn = `return (
    <div className="min-h-screen bg-black font-sans w-[100vw] overflow-x-hidden">`;

const newReturn = `return (
    <div className="min-h-screen bg-black font-sans w-[100vw] overflow-x-hidden">
      {/* Fast Intro Splash */}
      <div 
        className={\`fixed inset-0 z-[200] bg-black flex items-center justify-center transition-opacity duration-700 ease-in-out \${!showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}\`}
      >
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-[#d4d4d4] text-5xl md:text-7xl font-black lowercase tracking-tight drop-shadow-md animate-pulse">
            miyoro
          </h1>
          <div className="w-32 md:w-40 h-1 bg-white/10 rounded-full overflow-hidden mt-1 relative">
            <div className="absolute top-0 left-0 h-full w-1/3 bg-[#d4d4d4] rounded-full" style={{ animation: 'loading-bar 1.5s infinite ease-in-out' }}></div>
          </div>
        </div>
      </div>`;

code = code.replace(oldReturn, newReturn);
fs.writeFileSync('src/pages/Landing.tsx', code);
