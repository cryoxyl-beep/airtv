const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

// For the gradient overlays in CinematicPosterWall
code = code.replace(
  '<div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/80 to-black w-full" />',
  '<div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-transparent via-black/90 to-black w-full" />'
);

// For the foreground panel positioning
code = code.replace(
  'className="absolute right-0 top-0 w-full md:w-[45%] lg:w-[35%] h-full flex flex-col justify-center px-8 md:px-12 z-20"',
  'className="absolute right-0 bottom-0 md:top-0 w-full md:w-[45%] lg:w-[35%] h-[60%] md:h-full flex flex-col justify-end md:justify-center px-8 md:px-12 pb-16 md:pb-0 z-20"'
);

fs.writeFileSync('src/pages/Landing.tsx', code);
