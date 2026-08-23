const fs = require('fs');

let content = fs.readFileSync('src/components/Hero.tsx', 'utf8');

const replacement = `if (activeItem.source === 'anilist') {
                  navigate(\`/watch/anime/\${activeItem.id}\`);
                } else if (activeItem.media_type === 'tv' || activeItem.first_air_date) {
                  navigate(\`/watch/tv/\${activeItem.id}\`);
                } else {
                  navigate(\`/watch/movie/\${activeItem.id}\`);
                }`;

content = content.replace(/if \(activeItem\.media_type === 'tv' \|\| activeItem\.first_air_date\) {[\s\S]*?navigate\(`\/watch\/tv\/\${activeItem\.id}`\);[\s\S]*?} else {[\s\S]*?navigate\(`\/watch\/movie\/\${activeItem\.id}`\);[\s\S]*?}/, replacement);

fs.writeFileSync('src/components/Hero.tsx', content, 'utf8');
console.log('Patched Hero.tsx');
