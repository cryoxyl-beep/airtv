const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // For Hero.tsx:
  // fetchTrailer(activeItem.id, ...)
  content = content.replace(/fetchTrailer\(activeItem\.id, activeItem\.media_type \|\| \(activeItem\.first_air_date \? 'tv' : 'movie'\)\)\n\s*\.then\(key => {/g, 
  `const fetchT = activeItem.source === 'anilist' 
      ? Promise.resolve(activeItem.trailer)
      : fetchTrailer(activeItem.id, activeItem.media_type || (activeItem.first_air_date ? 'tv' : 'movie'));
    
    fetchT.then(key => {`);

  // For WatchPlayer.tsx:
  // fetchTrailer(item.id, type).then(key => {
  content = content.replace(/fetchTrailer\(item\.id, type\)\.then\(key => {/g,
  `const fetchT = item.source === 'anilist'
      ? Promise.resolve(item.trailer)
      : fetchTrailer(item.id, type);
      
    fetchT.then(key => {`);

  fs.writeFileSync(file, content, 'utf8');
}

patchFile('src/components/Hero.tsx');
patchFile('src/components/WatchPlayer.tsx');
console.log('Patched Hero and WatchPlayer trailers');
