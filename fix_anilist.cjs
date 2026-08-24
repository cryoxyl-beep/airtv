const fs = require('fs');
let content = fs.readFileSync('src/api/anilist.ts', 'utf8');
const lines = content.split('\n');

// Line 151 (0-indexed 150) should be: return { results: await deduplicateAnimeList(results.filter(Boolean)) };
if (lines[150].includes('return { results: results.filter(Boolean) };')) {
  lines[150] = lines[150].replace('return { results: results.filter(Boolean) };', 'return { results: await deduplicateAnimeList(results.filter(Boolean)) };');
}

// Line 438 (0-indexed 437) should be: return { results: results.filter(Boolean) };
if (lines[437].includes('return { results: await deduplicateAnimeList(results.filter(Boolean)) };')) {
  lines[437] = lines[437].replace('return { results: await deduplicateAnimeList(results.filter(Boolean)) };', 'return { results: results.filter(Boolean) };');
}

fs.writeFileSync('src/api/anilist.ts', lines.join('\n'), 'utf8');
