const https = require('https');
https.get('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
    if (data.length > 5000) res.destroy(); // just get a chunk
  });
  res.on('close', () => {
    console.log(data.substring(0, 2000));
  });
});
