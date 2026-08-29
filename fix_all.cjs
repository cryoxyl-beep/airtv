const fs = require('fs');

// Fix animeResolver.ts
let code = fs.readFileSync('src/api/animeResolver.ts', 'utf-8');
code = code.replace(/\\`Episode \\\$\\{epNum\\}\\`/g, '`Episode ${epNum}`');
fs.writeFileSync('src/api/animeResolver.ts', code);

// Fix WatchPage.tsx
let wp = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');
wp = wp.replace(/\} catch \\(err: any\\) \{/, '');
wp = wp.replace(/console\\.error\\("Failed to load watch data:", err\\.message \\|\\| err\\);/, '');
wp = wp.replace(/setError\\(true\\);/, '');
wp = wp.replace(/\} finally \{/, '} catch (err: any) { console.error("Failed", err); setError(true); } finally {');
fs.writeFileSync('src/pages/WatchPage.tsx', wp);

