const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

// 1. Add GoogleIcon component below imports
const importsTarget = `import { ChevronRight, User } from 'lucide-react';`;
const googleIconComponent = `import { ChevronRight, User } from 'lucide-react';

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);`;
code = code.replace(importsTarget, googleIconComponent);

// 2. Replace the login and guest area
const oldAuthGuest = `            {/* Account / Login Area */}
            {isLoggedIn ? (
              <div 
                onClick={() => navigate('/home')}
                className="flex items-center gap-4 group cursor-pointer w-max"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/40 transition-colors">
                  <User className="w-5 h-5 text-white/70 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg tracking-wide">{userProfile.name}</h3>
                  <p className="text-white/50 text-sm group-hover:text-white transition-colors flex items-center gap-1">
                    Your Profile <ChevronRight className="w-3 h-3" />
                  </p>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => navigate('/home')} // Route to auth/home
                className="text-left group flex flex-col gap-1 w-max"
              >
                <span className="text-white text-xl md:text-2xl font-semibold tracking-wide flex items-center gap-2">
                  Sign in <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </span>
                <div className="h-[2px] w-0 bg-white group-hover:w-full transition-all duration-300 ease-out" />
              </button>
            )}

            {/* Guest Entry */}
            <div 
              onClick={() => navigate('/home')}
              className="flex flex-col group cursor-pointer w-max mt-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              <h3 className="text-white/80 font-medium text-base mb-1">Guest</h3>
              <p className="text-white/40 text-sm group-hover:text-white/80 transition-colors flex items-center gap-1">
                Continue as Guest <ChevronRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>`;

const newAuthGuest = `            {/* Account / Login Area */}
            {isLoggedIn ? (
              <div 
                onClick={() => navigate('/home')}
                className="flex items-center gap-4 group cursor-pointer w-max"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/40 transition-colors">
                  <User className="w-5 h-5 text-white/70 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg tracking-wide">{userProfile.name}</h3>
                  <p className="text-white/50 text-sm group-hover:text-white transition-colors flex items-center gap-1">
                    Your Profile <ChevronRight className="w-3 h-3" />
                  </p>
                </div>
              </div>
            ) : (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  // Temporarily blocked per instructions
                }}
                className="text-left group flex flex-col gap-1 w-max cursor-not-allowed opacity-50"
                disabled
              >
                <span className="text-white text-xl md:text-2xl font-semibold tracking-wide flex items-center gap-3">
                  <GoogleIcon className="w-6 h-6" />
                  Sign in with Google
                </span>
                <div className="h-[2px] w-0 bg-white transition-all duration-300 ease-out" />
              </button>
            )}

            {/* Guest Entry */}
            <div 
              onClick={() => navigate('/home')}
              className="flex items-center gap-4 group cursor-pointer w-max mt-4"
            >
              <div className="w-12 h-12 rounded-full bg-[#141414] flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/40 transition-all duration-300 shadow-xl">
                <img 
                  src="https://api.dicebear.com/9.x/lorelei/svg?seed=Miyoro&backgroundColor=transparent" 
                  alt="Guest" 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                />
              </div>
              <div className="flex flex-col">
                <h3 className="text-white/90 font-medium text-lg tracking-wide group-hover:text-white transition-colors">Guest</h3>
                <p className="text-white/50 text-sm group-hover:text-white/90 transition-colors flex items-center gap-1">
                  Continue as Guest <ChevronRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </div>`;

code = code.replace(oldAuthGuest, newAuthGuest);
fs.writeFileSync('src/pages/Landing.tsx', code);
