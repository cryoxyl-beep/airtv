const fs = require('fs');

let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

// Bug 1: Remove opacity classes from image
code = code.replace(/className="w-full h-full object-cover opacity-60 md:opacity-80"/g, 'className="w-full h-full object-cover"');

// Bug 2: Add canReveal state
if (!code.includes('const [canReveal, setCanReveal] = useState(false);')) {
  code = code.replace(/const \[isMuted, setIsMuted\] = useState\(false\);/, 'const [isMuted, setIsMuted] = useState(false);\n  const [canReveal, setCanReveal] = useState(false);');
}

// Add the useEffect for canReveal
if (!code.includes('setCanReveal(true);')) {
  code = code.replace(/return \(\) => \{ mounted = false; \};\n  \}, \[item, type\]\);/, `return () => { mounted = false; };
  }, [item, type]);

  useEffect(() => {
    if (!trailerKey) return;
    const timer = setTimeout(() => {
      setCanReveal(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [trailerKey]);`);
}

// Update isTrailerVisible
code = code.replace(/const isTrailerVisible = trailerPlaying && !trailerEnded && trailerKey !== null;/, 'const isTrailerVisible = trailerPlaying && canReveal && !trailerEnded && trailerKey !== null;');

// Bug 3: Remove fallback timer
code = code.replace(/\/\/ Fallback: if we never get the playing event \([\s\S]*?\}, 3000\);/m, '');
code = code.replace(/clearTimeout\(fallbackTimer\);\n\s*/, '');

fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
