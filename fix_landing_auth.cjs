const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

const oldAuth = `<div 
                onClick={() => navigate('/home')}
                className="flex items-center gap-4 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/5 group-hover:border-white/30 transition-colors">
                  <User className="w-5 h-5 text-white/50 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg">Guest</h3>
                  <p className="text-white/50 text-sm group-hover:text-white/80 transition-colors flex items-center gap-1">
                    Continue as Guest <ChevronRight className="w-3 h-3" />
                  </p>
                </div>
              </div>`;

const newAuth = `<div className="flex flex-col gap-6">
                <button className="text-left group flex flex-col gap-1 w-max">
                  <span className="text-white text-lg font-medium tracking-wide">Login to Miyoro</span>
                  <div className="h-[2px] w-0 bg-white group-hover:w-full transition-all duration-300 ease-out" />
                </button>
                
                <div 
                  onClick={() => navigate('/home')}
                  className="flex items-center gap-4 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors">
                    <User className="w-4 h-4 text-white/50 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Guest</h3>
                    <p className="text-white/40 text-sm group-hover:text-white/80 transition-colors flex items-center gap-1">
                      Continue as Guest <ChevronRight className="w-3 h-3" />
                    </p>
                  </div>
                </div>
              </div>`;

code = code.replace(oldAuth, newAuth);
fs.writeFileSync('src/pages/Landing.tsx', code);
