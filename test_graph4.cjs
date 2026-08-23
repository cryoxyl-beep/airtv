const fetch = globalThis.fetch;
const query = `
query {
  Media(id: 16498) { # AOT
    id
    relations {
      edges {
        relationType
        node {
          id
          title { english }
          type
          relations {
            edges {
              relationType
              node {
                id
                title { english }
                format
                type
                startDate { year month day }
              }
            }
          }
        }
      }
    }
  }
}`;

function extractFromManga(media) {
  let mangaNode = null;
  for (const edge of media.relations.edges) {
    if (edge.relationType === 'ADAPTATION' && edge.node.type === 'MANGA') {
      mangaNode = edge.node;
      break;
    }
  }
  
  if (!mangaNode) return [];
  
  const validFormats = ['TV', 'TV_SHORT', 'ONA', 'SPECIAL'];
  const seasons = [];
  
  for (const edge of mangaNode.relations.edges) {
    if (edge.relationType === 'ADAPTATION' && edge.node.type === 'ANIME' && validFormats.includes(edge.node.format)) {
      seasons.push(edge.node);
    }
  }
  
  seasons.sort((a, b) => {
    const dateA = new Date(a.startDate.year || 9999, (a.startDate.month || 1)-1, a.startDate.day || 1).getTime();
    const dateB = new Date(b.startDate.year || 9999, (b.startDate.month || 1)-1, b.startDate.day || 1).getTime();
    return dateA - dateB;
  });
  
  return seasons.map(s => ({ id: s.id, title: s.title.english, format: s.format }));
}

fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(d => console.log(extractFromManga(d.data.Media)));
