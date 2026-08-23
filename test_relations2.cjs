fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `
query {
  Media(id: 145064) { # Jujutsu Kaisen Season 2
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
}` })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
