const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

const target = `            {/* Account / Login Area */}
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

const replacement = `            {/* Account / Login Area */}
            {isLoggedIn ? (
              <div 
                onClick={() => navigate('/home')}
                className="flex items-center gap-4 group cursor-pointer w-max p-3 -ml-3 rounded-2xl hover:bg-white/5 transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:translate-x-2"
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
                className="text-left group flex flex-col gap-1 w-max cursor-not-allowed opacity-50 p-3 -ml-3 rounded-2xl hover:bg-white/5 transition-all duration-400 ease-out hover:translate-x-1"
                disabled
              >
                <span className="text-white text-xl md:text-2xl font-semibold tracking-wide flex items-center gap-3">
                  <GoogleIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                  Sign in with Google
                </span>
                <div className="h-[2px] w-0 bg-white group-hover:w-full transition-all duration-500 ease-out" />
              </button>
            )}

            {/* Guest Entry */}
            <div 
              onClick={() => navigate('/home')}
              className="flex items-center gap-4 group cursor-pointer w-max mt-2 p-3 -ml-3 rounded-2xl hover:bg-white/5 transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1.2)] hover:translate-x-2"
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
                  Continue as Guest <ChevronRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform duration-300" />
                </p>
              </div>
            </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/Landing.tsx', code);
