const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

const target = `{location.pathname === '/' && (
          <h1 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-[#d4d4d4] text-3xl md:text-4xl font-black lowercase tracking-tight drop-shadow-md cursor-pointer transition-transform hover:scale-105 select-none"
          >
            miyoro
          </h1>
        )}`;

const replacement = `{(location.pathname === '/' || location.pathname === '/search') && (
          <h1 
            onClick={() => {
              if (location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                navigate('/');
              }
            }}
            className="text-[#d4d4d4] text-3xl md:text-4xl font-black lowercase tracking-tight drop-shadow-md cursor-pointer transition-transform hover:scale-105 select-none"
          >
            miyoro
          </h1>
        )}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Navbar.tsx', code);
