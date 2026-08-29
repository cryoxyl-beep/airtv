const https = require('https');
const apikey = "83ebc05e-3618-442c-b90e-cd5b60817a77";

const req = https.request('https://api4.thetvdb.com/v4/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const token = JSON.parse(body).data.token;
    console.log("Token:", token.substring(0, 20) + "...");
    
    // Now get AoT S3 episode 1 (absolute 38? or season 3 ep 1?)
    // AoT TVDB ID: 267440
    https.get('https://api4.thetvdb.com/v4/series/267440/episodes/default/eng?page=0', {
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res2) => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        const episodes = JSON.parse(body2).data.episodes;
        const s3e1 = episodes.find(e => e.seasonNumber === 3 && e.number === 1);
        console.log("S3E1:", JSON.stringify(s3e1, null, 2));
      });
    });
  });
});
req.write(JSON.stringify({ apikey }));
req.end();
