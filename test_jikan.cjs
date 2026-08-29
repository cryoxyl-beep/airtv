const https = require('https');
https.get('https://api.jikan.moe/v4/anime/35760/episodes', (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log("Jikan response:", body.substring(0, 500));
  });
});
