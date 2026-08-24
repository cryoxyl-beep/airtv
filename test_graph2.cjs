const fetch = globalThis.fetch;
const query = `
query {
  Media(id: 172463) { # JJK S3
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

function extractMainSeasons(media) {
  const nodes = new Map();
  nodes.set(media.id, media);
  
  // We want to walk only PREQUEL and SEQUEL paths.
  // Since we have a 2-level graph, we can just build a local adj list of ONLY PREQUEL/SEQUEL.
  const adj = new Map();
  function addEdge(a, b, type) {
    if (type !== 'PREQUEL' && type !== 'SEQUEL') return;
    if (a.type !== 'ANIME' || b.type !== 'ANIME') return;
    // skip non-main formats (e.g. movies, specials) unless they are strictly the sequel?
    // Actually, "Attack on Titan: The Final Chapters" are SPECIAL format.
    // Let's just collect all connected via PREQUEL/SEQUEL
    nodes.set(a.id, a);
    nodes.set(b.id, b);
    if (!adj.has(a.id)) adj.set(a.id, []);
    if (!adj.has(b.id)) adj.set(b.id, []);
    adj.get(a.id).push(b.id);
    adj.get(b.id).push(a.id);
  }

  for (const edge of media.relations.edges) {
    addEdge(media, edge.node, edge.relationType);
    if (edge.node.relations) {
      for (const subEdge of edge.node.relations.edges) {
         addEdge(edge.node, subEdge.node, subEdge.relationType);
      }
    }
  }
  
  // Now find connected component containing `media.id`
  const visited = new Set();
  const queue = [media.id];
  visited.add(media.id);
  
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const neighbor of (adj.get(cur) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  
  // Convert visited to array and sort by start date
  const seasons = Array.from(visited).map(id => nodes.get(id)).sort((a, b) => {
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
}).then(r => r.json()).then(d => console.log(extractMainSeasons(d.data.Media)));
