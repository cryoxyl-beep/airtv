const fs = require('fs');
const https = require('https');
https.get('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json', (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    const op = data.find(x => x.anilist_id === 21);
    console.log("One Piece:", JSON.stringify(op, null, 2));
    const aot3 = data.find(x => x.anilist_id === 99147);
    console.log("AoT 3:", JSON.stringify(aot3, null, 2));
  });
});
