const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

const targetGradients = `      {/* Layer 2: Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent pointer-events-none z-20" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent w-full md:w-[70%] pointer-events-none z-20" />`;

const newGradients = `      {/* Layer 2: Gradients */}
      <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/70 to-transparent pointer-events-none z-20" />
      <div className="absolute left-0 bottom-0 h-[70%] w-full md:w-[60%] lg:w-[50%] bg-gradient-to-r from-[#0b0b0b]/90 via-[#0b0b0b]/40 to-transparent pointer-events-none z-20" />`;

code = code.replace(targetGradients, newGradients);
fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
