const fs = require('fs');

let code = fs.readFileSync('src/components/EpisodeList.tsx', 'utf-8');

// Replace the outer container className
code = code.replace(
  `className="flex flex-col gap-3 group cursor-pointer relative"`,
  `className="flex flex-col gap-3 group cursor-pointer relative transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:z-50 hover:scale-[1.03]"`
);

// Replace the image container className
code = code.replace(
  `className={\`relative aspect-video rounded-xl overflow-hidden bg-[#141414] border transition-all duration-300 shadow-lg \${isActive ? 'border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.15)] ring-2 ring-white ring-offset-2 ring-offset-[#0b0b0b]' : 'border-white/10 group-hover:border-white/30'}\`}`,
  `className={\`relative aspect-video rounded-xl overflow-hidden bg-[#141414] border shadow-[0_4px_15px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.06)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] \${isActive ? 'border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.15)] ring-2 ring-white ring-offset-2 ring-offset-[#0b0b0b]' : 'border-white/10 group-hover:border-white/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.8),0_0_25px_rgba(255,255,255,0.15)]'}\`}`
);

// Replace the img className
code = code.replace(
  `className={\`w-full h-full object-cover transition-all duration-500 ease-out \${isActive ? 'brightness-110 scale-105' : 'brightness-75 group-hover:brightness-100 group-hover:scale-105'}\`}`,
  `className={\`w-full h-full object-cover transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1.2)] \${isActive ? 'brightness-110 scale-105' : 'brightness-75 group-hover:brightness-110 group-hover:scale-105'}\`}`
);

fs.writeFileSync('src/components/EpisodeList.tsx', code);
