import { fetchAnimeByGenre, fetchNewlyAddedAnime } from './src/api/anilist';

Promise.all([
  fetchAnimeByGenre('Romance', 1),
  fetchAnimeByGenre('Action', 1),
  fetchNewlyAddedAnime(1)
]).then(() => console.log("Success")).catch(console.error);
