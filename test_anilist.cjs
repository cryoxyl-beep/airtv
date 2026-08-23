const query = `
query {
  Page(page: 1, perPage: 10) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title { english }
      relations {
        edges {
          relationType
          node {
            id
            title { english }
            format
          }
        }
      }
    }
  }
}`;
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d).substring(0, 500)));
