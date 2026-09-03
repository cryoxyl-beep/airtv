const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

// Add imports
code = code.replace(
  "import { Search, X, SlidersHorizontal } from 'lucide-react';",
  "import { Search, X, SlidersHorizontal, LogOut, User } from 'lucide-react';\nimport { useAuth } from '../contexts/AuthContext';"
);

// Add useAuth hook
code = code.replace(
  "export default function Navbar() {",
  "export default function Navbar() {\n  const { currentUser, logout } = useAuth();"
);

// Modify layout to put profile next to search container
code = code.replace(
  /<div id="search-form-container".*?relative">/,
  '<div className="flex items-center gap-4 pointer-events-auto">\n      <div id="search-form-container" className="flex justify-end w-full md:w-auto relative">'
);

// Close the flex container at the end
code = code.replace(
  `        </div>
      </div>
    </div>
  );
}`,
  `        </div>
      </div>
      {currentUser && (
        <div className="relative group flex items-center">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border border-white/20 hover:border-white/50 transition-colors shadow-lg cursor-pointer flex items-center justify-center bg-[#1A1A1A]">
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-white/70" />
            )}
          </div>
          <div className="absolute right-0 top-full mt-2 w-40 bg-[#1A1A1A]/95 border border-white/10 shadow-2xl backdrop-blur-xl rounded-xl overflow-hidden opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 origin-top-right">
            <button
              onClick={logout}
              className="w-full px-4 py-3 text-left text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-3 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}`
);

fs.writeFileSync('src/components/Navbar.tsx', code);
