import { fetchAnimeByGenre } from './src/api/anilist';

fetchAnimeByGenre('Drama', 1).then(console.log).catch(console.error);
