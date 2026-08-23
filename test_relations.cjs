const query = `
query {
  Media(id: 113415) { # Jujutsu Kaisen
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
}`;
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
