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
    
    https.get('https://api4.thetvdb.com/v4/series/81797/episodes/default/eng?page=1', {
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res2) => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        const episodes = JSON.parse(body2).data?.episodes || [];
        const e500 = episodes.find(e => e.absoluteNumber === 500 || (e.seasonNumber === 14 && e.number === 10)); // just guessing
        console.log("EP500 matches:", episodes.filter(e => e.absoluteNumber === 500).length);
        console.log("First episode absolute:", episodes[0]?.absoluteNumber, "season:", episodes[0]?.seasonNumber, "num:", episodes[0]?.number);
      });
    });
  });
});
req.write(JSON.stringify({ apikey }));
req.end();
