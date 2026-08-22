const https = require('https');
const fs = require('fs');
const token = fs.readFileSync('src/api/tmdb.ts', 'utf8').match(/API_READ_TOKEN = '([^']+)'/)[1];
const options = { hostname: 'api.themoviedb.org', path: '/3/watch/providers/movie?language=en-US&watch_region=US', headers: { 'Authorization': 'Bearer ' + token } };
https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const results = json.results.filter(p => [8, 9, 337, 350, 15, 1899, 384].includes(p.provider_id));
    console.log(JSON.stringify(results.map(p => ({id: p.provider_id, name: p.provider_name, logo: p.logo_path})), null, 2));
  });
});
