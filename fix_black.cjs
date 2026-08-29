const fs = require('fs');

// Fix WatchPage page
let page = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');
page = page.replace(/bg-\[#0b0b0b\]/g, 'bg-black');
fs.writeFileSync('src/pages/WatchPage.tsx', page);

// Fix WatchPage component
let comp = fs.readFileSync('src/components/WatchPage.tsx', 'utf-8');
// Fix all background instances in the component
comp = comp.replace(/bg-\[#0b0b0b\]/g, 'bg-black');

// Update the gradient specifically to fade into #000 (black) instead of #0b0b0b
const oldGrad = "linear-gradient(to top, #0b0b0b 0px, rgba(11,11,11, 0.98) 15px, rgba(11,11,11, 0.85) 50px, rgba(11,11,11, 0.5) 150px, rgba(11,11,11, 0.1) 250px, transparent 300px)";
const newGrad = "linear-gradient(to top, #000 0px, rgba(0,0,0,0.98) 15px, rgba(0,0,0,0.85) 50px, rgba(0,0,0,0.5) 150px, rgba(0,0,0,0.1) 250px, transparent 300px)";
if (comp.includes(oldGrad)) {
  comp = comp.replace(oldGrad, newGrad);
} else {
  // Regex just in case
  comp = comp.replace(/linear-gradient\(to top, #0b0b0b 0px[^)]+\)/, newGrad);
}
fs.writeFileSync('src/components/WatchPage.tsx', comp);

