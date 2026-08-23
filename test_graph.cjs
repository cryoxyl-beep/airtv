const fetch = globalThis.fetch;
const query = `
query {
  Media(id: 172463) { # JJK S3
    id
    title { english }
    format
    startDate { year month day }
    relations {
      edges {
        relationType
        node {
          id
          title { english }
          format
          type
          startDate { year month day }
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

function extractSeasons(media) {
  const nodes = new Map();
  function addNode(n) {
    if (n && n.type === 'ANIME' && (n.format === 'TV' || n.format === 'TV_SHORT' || n.format === 'ONA')) {
      nodes.set(n.id, n);
    }
  }
  
  addNode(media);
  
  for (const edge of media.relations.edges) {
    // If it's a direct prequel/sequel or an adaptation (source material)
    addNode(edge.node);
    if (edge.node.relations) {
      for (const subEdge of edge.node.relations.edges) {
         addNode(subEdge.node);
      }
    }
  }
  
  // Convert to array and sort by start date
  const seasons = Array.from(nodes.values()).sort((a, b) => {
    const dateA = new Date(a.startDate.year, a.startDate.month-1, a.startDate.day).getTime();
    const dateB = new Date(b.startDate.year, b.startDate.month-1, b.startDate.day).getTime();
    return dateA - dateB;
  });
  
  return seasons.map(s => ({ id: s.id, title: s.title.english }));
}

fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(d => console.log(extractSeasons(d.data.Media)));
