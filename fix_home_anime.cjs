const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

code = code.replace(/fetchTrendingAnime\(15, true\)/g, 'fetchTrendingAnime(15)');
code = code.replace(/fetchNewlyAddedAnime\(15, true\)/g, 'fetchNewlyAddedAnime(15)');
code = code.replace(/fetchAnimeByGenre\('Romance', 15, true\)/g, "fetchAnimeByGenre('Romance', 15)");
code = code.replace(/fetchAnimeByGenre\('Action', 15, true\)/g, "fetchAnimeByGenre('Action', 15)");
code = code.replace(/fetchAnimeByGenre\('Comedy', 15, true\)/g, "fetchAnimeByGenre('Comedy', 15)");
code = code.replace(/fetchAnimeByGenre\('Drama', 15, true\)/g, "fetchAnimeByGenre('Drama', 15)");

fs.writeFileSync('src/pages/Home.tsx', code);
