const fs = require('fs');
let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

const target = `const fetchAniList = async (query: string, variables: any = {}) => {
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
  const response = await fetch(ANILIST_API_URL, options);
  if (!response.ok) {
    console.error('AniList API error:', response.status, await response.text());
    throw new Error('AniList API error: ' + response.status);
  }
  return response.json();
};`;

const replacement = `const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchAniList = async (query: string, variables: any = {}, retries = 3): Promise<any> => {
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

content = content.replace(target, replacement);

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
