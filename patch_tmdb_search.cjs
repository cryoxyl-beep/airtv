const fs = require('fs');
let content = fs.readFileSync('src/api/tmdb.ts', 'utf8');

const searchFunctions = `
export const searchMovies = async (query: string) => {
  try {
    const res = await fetch(\`\${BASE_URL}/search/movie?query=\${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1\`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
      data.results.forEach((r: any) => { r.media_type = 'movie'; });
    }
    return data;
  } catch (error) {
    console.warn("searchMovies failed:", error);
    return { results: [] };
  }
};

export const searchTV = async (query: string) => {
  try {
    const res = await fetch(\`\${BASE_URL}/search/tv?query=\${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1\`, fetchOptions);
    if (!res.ok) throw new Error('Not OK');
    const data = await res.json();
    if (data && data.results) {
      data.results = filterOutAnime(data.results);
      data.results.forEach((r: any) => { r.media_type = 'tv'; });
    }
    return data;
  } catch (error) {
    console.warn("searchTV failed:", error);
    return { results: [] };
  }
};
`;

content += searchFunctions;
fs.writeFileSync('src/api/tmdb.ts', content, 'utf8');
