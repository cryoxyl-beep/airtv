const query = `
query {
  Media(id: 172463) { # JJK S3
    id
    relations {
      edges {
        relationType
        node {
          id
          title { english }
          relations {
            edges {
              relationType
              node {
                id
                title { english }
              }
            }
          }
        }
      }
    }
  }
}`;
globalThis.fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
