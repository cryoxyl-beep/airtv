const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

const target = `<div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>`;

const replacement = `<div className="w-32 md:w-40 h-1 bg-white/10 rounded-full overflow-hidden mt-1 relative">
              <div className="absolute top-0 left-0 h-full w-1/3 bg-[#d4d4d4] rounded-full" style={{ animation: 'loading-bar 1.5s infinite ease-in-out' }}></div>
            </div>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/Home.tsx', code);
