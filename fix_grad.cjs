const fs = require('fs');
let code = fs.readFileSync('src/components/WatchPage.tsx', 'utf-8');
const oldGrad = "linear-gradient(to top, #0b0b0b 0px, rgba(11,11,11,0.9) 30px, rgba(11,11,11,0.7) 100px, rgba(11,11,11,0.3) 200px, transparent 300px)";
const newGrad = "linear-gradient(to top, #0b0b0b 0px, rgba(11,11,11, 0.98) 15px, rgba(11,11,11, 0.85) 50px, rgba(11,11,11, 0.5) 150px, rgba(11,11,11, 0.1) 250px, transparent 300px)";
if (code.includes(oldGrad)) {
  code = code.replace(oldGrad, newGrad);
} else {
  // just in case it didn't match perfectly, regex replace
  code = code.replace(/linear-gradient\(to top, #0b0b0b 0px[^)]+\)/, newGrad);
}
fs.writeFileSync('src/components/WatchPage.tsx', code);
