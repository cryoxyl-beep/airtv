const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

// Replace the safeFetch to include a stagger delay
const target = `    const loadData = async () => {
      const safeFetch = async (promise: Promise<any>) => {
        try {
          return await promise;
        } catch (e) {
          console.error("Safe fetch failed:", e);
          return { results: [] };
        }
      };`;

const replacement = `    const loadData = async () => {
      let delayMs = 0;
      const safeFetch = async (promiseFn: () => Promise<any>) => {
        const currentDelay = delayMs;
        delayMs += 150; // stagger requests by 150ms
        try {
          if (currentDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, currentDelay));
          }
          return await promiseFn();
        } catch (e) {
          console.error("Safe fetch failed:", e);
          return { results: [] };
        }
      };`;

content = content.replace(target, replacement);

// And update the calls
const targetCalls = `          safeFetch(fetchTrending()),
          safeFetch(fetchTop10()),
          safeFetch(fetchByGenre(28)), // Action
          safeFetch(fetchByGenre(35)), // Comedy
          safeFetch(fetchByGenre(10749)), // Romance
          safeFetch(fetchByGenre(878)), // Sci-Fi
          safeFetch(fetchByGenre(27)), // Horror
          safeFetch(fetchTVByGenre(35)), // Sitcoms
          safeFetch(fetchByGenre(10751)), // Family
          safeFetch(fetchByGenre(80)), // Crime
          safeFetch(fetchByGenre(18)), // Drama
          safeFetch(fetchTrendingAnime(10)),
          safeFetch(fetchNewlyAddedAnime(10)),
          safeFetch(fetchAnimeByGenre('Romance', 10)),
          safeFetch(fetchAnimeByGenre('Action', 10)),
          safeFetch(fetchAnimeByGenre('Comedy', 10)),
          safeFetch(fetchAnimeByGenre('Drama', 10))`;

const replacementCalls = `          safeFetch(() => fetchTrending()),
          safeFetch(() => fetchTop10()),
          safeFetch(() => fetchByGenre(28)), // Action
          safeFetch(() => fetchByGenre(35)), // Comedy
          safeFetch(() => fetchByGenre(10749)), // Romance
          safeFetch(() => fetchByGenre(878)), // Sci-Fi
          safeFetch(() => fetchByGenre(27)), // Horror
          safeFetch(() => fetchTVByGenre(35)), // Sitcoms
          safeFetch(() => fetchByGenre(10751)), // Family
          safeFetch(() => fetchByGenre(80)), // Crime
          safeFetch(() => fetchByGenre(18)), // Drama
          safeFetch(() => fetchTrendingAnime(10)),
          safeFetch(() => fetchNewlyAddedAnime(10)),
          safeFetch(() => fetchAnimeByGenre('Romance', 10)),
          safeFetch(() => fetchAnimeByGenre('Action', 10)),
          safeFetch(() => fetchAnimeByGenre('Comedy', 10)),
          safeFetch(() => fetchAnimeByGenre('Drama', 10))`;

content = content.replace(targetCalls, replacementCalls);

fs.writeFileSync('src/pages/Home.tsx', content, 'utf8');
