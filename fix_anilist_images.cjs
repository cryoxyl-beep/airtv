const fs = require('fs');

let code = fs.readFileSync('src/api/anilist.ts', 'utf-8');

const fetchTmdbSnippet = `
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYmM3ZjM4ZTEwNzBmMWI4NzM2MDc4OTM4MDA1OThkOSIsIm5iZiI6MTcxNzIxNDAzNi4wMzIsInN1YiI6IjY2NWE5YjU0M2MzMmNiMWFiZmFmMGFmOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.BEKlgnL8r52GcU2Fb8QXcp3W9-giqabR8AtbBlGDmU0';

const fetchTmdbImages = async (tmdbId, tmdbType) => {
  try {
    const url = \`https://api.themoviedb.org/3/\${tmdbType}/\${tmdbId}\`;
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        Authorization: \`Bearer \${TMDB_TOKEN}\`
      }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path
      };
    }
  } catch (e) {
    console.error('fetchTmdbImages failed', e);
  }
  return null;
};
`;

// Insert after sleep function
code = code.replace("const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));", "const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));\n" + fetchTmdbSnippet);

const normalizeFind = `  let poster_path = media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = media.bannerImage || media.coverImage?.extraLarge;`;

const normalizeReplace = `  let poster_path = media.coverImage?.extraLarge || media.coverImage?.large;
  let backdrop_path = media.bannerImage || media.coverImage?.extraLarge;
  
  // Override with TMDB images if mapped
  if (tmdbId && tmdbType) {
    const tmdbImages = await fetchTmdbImages(tmdbId, tmdbType);
    if (tmdbImages) {
      if (tmdbImages.poster_path) poster_path = tmdbImages.poster_path;
      if (tmdbImages.backdrop_path) backdrop_path = tmdbImages.backdrop_path;
    }
  }`;

code = code.replace(normalizeFind, normalizeReplace);
fs.writeFileSync('src/api/anilist.ts', code);
