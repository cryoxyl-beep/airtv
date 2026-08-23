const fs = require('fs');

let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

content = content.replace(/let poster_path = tmdbData\?\.poster_path \|\| media\.coverImage\?\.extraLarge \|\| media\.coverImage\?\.large;/, 
  `let poster_path = media.coverImage?.extraLarge || media.coverImage?.large || tmdbData?.poster_path;`);

content = content.replace(/let backdrop_path = tmdbData\?\.backdrop_path \|\| media\.bannerImage \|\| media\.coverImage\?\.extraLarge;/, 
  `let backdrop_path = media.bannerImage || media.coverImage?.extraLarge || tmdbData?.backdrop_path;`);

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
