const fs = require('fs');

let c = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');
const startIdx = c.indexOf('{isProviderActive && showBottomSection && showEpisodeOverlay');
if (startIdx !== -1) {
    const endIdx = c.indexOf(')}', startIdx);
    const endIdx2 = c.indexOf(')}', endIdx + 2); // it's nested
    const endIdx3 = c.indexOf(')}', endIdx2 + 2); // one more just to be safe
    const realEnd = c.indexOf('/>\n      )}', startIdx);
    if (realEnd !== -1) {
        c = c.substring(0, startIdx) + c.substring(realEnd + 12);
    }
}
fs.writeFileSync('src/pages/WatchPage.tsx', c);
console.log('Removed leftover EpisodeOverlay block');
