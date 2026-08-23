const fs = require('fs');
let content = fs.readFileSync('src/components/WatchPlayer.tsx', 'utf8');

const targetClassLike = `className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 transition-all shadow-xl ml-2"`;
const replacementClassLike = `className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group ml-2"`;

const targetClassDislike = `className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/30 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 transition-all shadow-xl"`;
const replacementClassDislike = `className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#1A1A1A]/80 border border-white/10 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.3),_0_4px_10px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center hover:bg-[#252525]/90 transition-all group"`;

content = content.replace(targetClassLike, replacementClassLike);
content = content.replace(targetClassDislike, replacementClassDislike);

fs.writeFileSync('src/components/WatchPlayer.tsx', content, 'utf8');
