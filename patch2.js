const fs = require('fs');
let code = fs.readFileSync('src/components/Row.tsx', 'utf-8');

code = code.replace(
`        {/* Trailer Iframe Layer */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#0b0b0b] pointer-events-none">
          {showTrailer && trailerKey && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-full h-full scale-[1.15] pointer-events-none">
              <iframe
                id={\`row-trailer-\${item.id}\`}
                key={\`iframe-\${item.id}\`}
                src={\`https://www.youtube.com/embed/\${trailerKey}?autoplay=1&mute=1&loop=1&playlist=\${trailerKey}&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=\${window.location.origin}&cc_load_policy=0\`}
                className="w-full h-full pointer-events-none object-cover"
                allow="autoplay; encrypted-media"
                tabIndex={-1}
              />
            </div>
          )}
        </div>

        {/* Poster & Logo Layer */}
        <div className={\`absolute inset-0 w-full h-full z-10 transition-opacity duration-700 ease-in-out pointer-events-none \${isPlaying ? 'opacity-0' : 'opacity-100'}\`}>
          <img
            src={\`\${IMAGE_BASE_URL_W500}\${item.backdrop_path}\`}
            alt={item.title || item.name}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
          {/* Logo Overlay with subtle bottom gradient for readability */}
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end items-center p-4 pointer-events-none z-20">
            {loadingLogo ? (
              <div className="w-[60%] h-6 bg-white/20 animate-pulse rounded"></div>
            ) : logo ? (
              <img
                src={logo}
                alt={item.title || item.name}
                className="max-h-12 max-w-[80%] object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
                draggable={false}
                loading="lazy"
              />
            ) : (
              <h3 className="text-white font-bold text-lg drop-shadow-md text-center">
                {item.title || item.name}
              </h3>
            )}
          </div>
        </div>
        
        {/* Transparent Blocker */}
        <div className="absolute inset-0 z-30 pointer-events-auto" />`,
`        {/* 1. Trailer Iframe Layer (z-0, pointer-events-none) */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#0b0b0b] pointer-events-none">
          {showTrailer && trailerKey && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-full h-full scale-[1.15] pointer-events-none">
              <iframe
                id={\`row-trailer-\${item.id}\`}
                key={\`iframe-\${item.id}\`}
                src={\`https://www.youtube.com/embed/\${trailerKey}?autoplay=1&mute=1&loop=1&playlist=\${trailerKey}&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=\${window.location.origin}&cc_load_policy=0\`}
                className="w-full h-full pointer-events-none object-cover"
                allow="autoplay; encrypted-media"
                tabIndex={-1}
              />
            </div>
          )}
        </div>

        {/* 3. Invisible Blocker Div (z-10) directly above iframe */}
        <div className="absolute inset-0 z-10 pointer-events-auto" />

        {/* 4. Poster Layer (z-20) */}
        <div className={\`absolute inset-0 w-full h-full z-20 transition-opacity duration-700 ease-in-out pointer-events-none \${isPlaying ? 'opacity-0' : 'opacity-100'}\`}>
          <img
            src={\`\${IMAGE_BASE_URL_W500}\${item.backdrop_path}\`}
            alt={item.title || item.name}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        </div>

        {/* Card Title/Hover UI (z-30) */}
        <div className={\`absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end items-center p-4 pointer-events-none z-30 transition-opacity duration-700 ease-in-out \${isPlaying ? 'opacity-0' : 'opacity-100'}\`}>
          {loadingLogo ? (
            <div className="w-[60%] h-6 bg-white/20 animate-pulse rounded"></div>
          ) : logo ? (
            <img
              src={logo}
              alt={item.title || item.name}
              className="max-h-12 max-w-[80%] object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <h3 className="text-white font-bold text-lg drop-shadow-md text-center">
              {item.title || item.name}
            </h3>
          )}
        </div>`);

fs.writeFileSync('src/components/Row.tsx', code);
