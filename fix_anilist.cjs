const fs = require('fs');
let code = fs.readFileSync('src/api/anilist.ts', 'utf-8');

// Replace Promise.all mappings with a sequential or chunked approach
const replacements = [
  {
    from: "const results = await Promise.all((data.data?.Page?.media || []).map(normalizeAniListToTmdb));",
    to: `    const mediaItems = data.data?.Page?.media || [];
    const results = [];
    for (const item of mediaItems) {
      results.push(await normalizeAniListToTmdb(item));
      // Add a tiny delay to prevent overwhelming TMDB connections
      await sleep(25);
    }`
  }
];

let replaced = code;
for (const r of replacements) {
  // Use replace with global flag if needed, or just split/join since they are multiple occurrences
  replaced = replaced.split(r.from).join(r.to);
}

fs.writeFileSync('src/api/anilist.ts', replaced);
