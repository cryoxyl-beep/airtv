const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

// Add states
code = code.replace(
  /const \[data, setData\] = useState<any>\(cachedHomeData \|\| \{/,
  `const [isLoading, setIsLoading] = useState(!cachedHomeData);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [data, setData] = useState<any>(cachedHomeData || {`
);

// Add the fade out logic at the end of loadData
const loadDataEnd = `        cachedHomeData = newData;
        setData(newData);
      } catch (err) {
        console.error("Failed to load TMDB data", err);
      }
    };`;

const newLoadDataEnd = `        cachedHomeData = newData;
        setData(newData);
        setIsFadingOut(true);
        setTimeout(() => setIsLoading(false), 800);
      } catch (err) {
        console.error("Failed to load TMDB data", err);
        setIsFadingOut(true);
        setTimeout(() => setIsLoading(false), 800);
      }
    };`;

code = code.replace(loadDataEnd, newLoadDataEnd);

// Add the Splash screen rendering
const renderReturn = `  return (
    <div className="min-h-screen bg-black pb-20 font-sans overflow-x-hidden w-[100vw]">`;

const newRenderReturn = `  return (
    <div className="min-h-screen bg-black pb-20 font-sans overflow-x-hidden w-[100vw]">
      {isLoading && (
        <div 
          className={\`fixed inset-0 z-[200] bg-black flex items-center justify-center transition-opacity duration-700 ease-in-out \${isFadingOut ? 'opacity-0' : 'opacity-100'}\`}
        >
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-white text-5xl md:text-7xl font-bold tracking-[0.2em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] animate-pulse">
              miyoro
            </h1>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}`;

code = code.replace(renderReturn, newRenderReturn);

fs.writeFileSync('src/pages/Home.tsx', code);
