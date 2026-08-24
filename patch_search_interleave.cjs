const fs = require('fs');
let content = fs.readFileSync('src/pages/SearchPage.tsx', 'utf8');

const target = `        combined.sort((a, b) => {
          const scoreA = a.popularity || (a.vote_average * 10) || 0;
          const scoreB = b.popularity || (b.vote_average * 10) || 0;
          return scoreB - scoreA;
        });
        
        setResults(combined);`;

const replacement = `        // Interleave results to keep a balanced mix of movies, series, and anime
        const maxLength = Math.max(
          movies.results?.length || 0,
          tv.results?.length || 0,
          anime.results?.length || 0
        );
        
        const interleaved = [];
        for (let i = 0; i < maxLength; i++) {
          if (movies.results && movies.results[i]) interleaved.push(movies.results[i]);
          if (tv.results && tv.results[i]) interleaved.push(tv.results[i]);
          if (anime.results && anime.results[i]) interleaved.push(anime.results[i]);
        }
        
        setResults(interleaved);`;

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/SearchPage.tsx', content, 'utf8');
