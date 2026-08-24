const ANILIST_API_URL = 'https://graphql.anilist.co';

const query = `
  query {
    Page(page: 1, perPage: 10) {
      media(search: "Chainsaw Man", type: ANIME) {
        id
        title { english romaji }
        format
        status
      }
    }
  }
`;

fetch(ANILIST_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
