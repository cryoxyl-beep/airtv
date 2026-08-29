const fs = require('fs');

function removeAnimeSelector(file) {
  let code = fs.readFileSync(file, 'utf-8');
  const startStr = "{type === 'anime' && data.animeGroup && data.animeGroup.seasons";
  const startIdx = code.indexOf(startStr);
  if (startIdx !== -1) {
    // find the closing parenthesis/bracket for this block
    // The block ends after the </div>)}
    const endStr = "</div>\n            )}";
    let endIdx = code.indexOf(endStr, startIdx);
    
    // In overlay, spaces might be different
    if (endIdx === -1) {
       const endStr2 = "</div>\n              )}";
       endIdx = code.indexOf(endStr2, startIdx);
       if (endIdx !== -1) endIdx += endStr2.length;
    } else {
       endIdx += endStr.length;
    }

    if (endIdx !== -1) {
       code = code.substring(0, startIdx) + code.substring(endIdx);
       fs.writeFileSync(file, code);
       console.log("Removed from " + file);
    } else {
       console.log("Could not find end for " + file);
    }
  }
}

removeAnimeSelector('src/pages/WatchPage.tsx');
removeAnimeSelector('src/components/EpisodeOverlay.tsx');
