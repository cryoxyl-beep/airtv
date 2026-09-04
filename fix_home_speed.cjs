const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

// Remove massive stagger
code = code.replace('delayMs += 500;', 'delayMs += 0; // Removed stagger to fix slow load');

// Pass true to all AniList fetches to skip TMDB images and use fast AniList images
code = code.replace(/fetchTrendingAnime\(10\)/g, 'fetchTrendingAnime(15, true)');
code = code.replace(/fetchNewlyAddedAnime\(10\)/g, 'fetchNewlyAddedAnime(15, true)');
code = code.replace(/fetchAnimeByGenre\('Romance', 10\)/g, "fetchAnimeByGenre('Romance', 15, true)");
code = code.replace(/fetchAnimeByGenre\('Action', 10\)/g, "fetchAnimeByGenre('Action', 15, true)");
code = code.replace(/fetchAnimeByGenre\('Comedy', 10\)/g, "fetchAnimeByGenre('Comedy', 15, true)");
code = code.replace(/fetchAnimeByGenre\('Drama', 10\)/g, "fetchAnimeByGenre('Drama', 15, true)");

fs.writeFileSync('src/pages/Home.tsx', code);
