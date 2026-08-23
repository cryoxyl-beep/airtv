const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

const targetStr = "{isTrailerVisible && (\\n        <div className={`absolute top-24 right-6 md:top-32 md:right-12 z-40 pointer-events-auto transition-opacity duration-500 ${isUiHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>";
// Using regex for flexibility
const newCode = code.replace(
  /\{\/\* Mute\/Unmute Button \*\/\}\s*\{isTrailerVisible && \(\s*<div className=\{`absolute top-24 right-6 md:top-32 md:right-12 z-40 pointer-events-auto transition-opacity duration-500 \$\{isUiHidden \? 'opacity-0 pointer-events-none' : 'opacity-100'\}`\}>/,
  `{/* Mute/Unmute Button */}
      {isTrailerVisible && (
        <div className="absolute top-6 right-6 z-50 pointer-events-auto">`
);

fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', newCode);
console.log("Patched Mute button");
