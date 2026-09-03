const fs = require('fs');
let code = fs.readFileSync('src/api/anilist.ts', 'utf-8');

const oldFetch = `const fetchAniList = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  };
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(ANILIST_API_URL, options);
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : (i + 1) * 1000;
          await sleep(delay);
          continue;
        }
        throw new Error('AniList API error: ' + response.status);
      }
      return await response.json();
    } catch (e: any) {
      if (i === retries - 1) throw e;
      await sleep((i + 1) * 1000);
    }
  }
};`;

const newFetch = `let anilistQueue: Promise<void> = Promise.resolve();

const fetchAniListInternal = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  };
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(ANILIST_API_URL, options);
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : (i + 1) * 1500;
          await sleep(delay);
          continue;
        }
        throw new Error('AniList API error: ' + response.status);
      }
      return await response.json();
    } catch (e: any) {
      // If it's a network error (often a CORS error hiding a 429), back off heavily
      if (i === retries - 1) throw e;
      await sleep((i + 1) * 1500);
    }
  }
};

const fetchAniList = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
  return new Promise((resolve, reject) => {
    anilistQueue = anilistQueue.then(async () => {
      try {
        const res = await fetchAniListInternal(query, variables, retries);
        resolve(res);
      } catch (e) {
        reject(e);
      }
      // Delay to respect AniList 90 req/min limit (~666ms per req)
      await sleep(750); 
    }).catch(async () => {
      await sleep(750);
    });
  });
};`;

code = code.replace(oldFetch, newFetch);
fs.writeFileSync('src/api/anilist.ts', code);
