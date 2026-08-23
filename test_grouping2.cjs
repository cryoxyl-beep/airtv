const fetch = globalThis.fetch;
// ... same code essentially
async function fetchMediaRelations(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        format
        startDate { year month day }
        coverImage { extraLarge large }
        bannerImage
        relations {
          edges {
            relationType
            node {
              id
              title { romaji english native }
              format
              type
            }
          }
        }
      }
    }
  `;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id } })
  });
  return (await res.json()).data.Media;
}

async function findCanonicalParent(id, visited = new Set()) {
  if (visited.has(id)) return null;
  visited.add(id);
  const media = await fetchMediaRelations(id);
  if (!media) return null;
  
  const prequels = media.relations.edges.filter(e => 
    e.relationType === 'PREQUEL' && 
    e.node.type === 'ANIME' && 
    (e.node.format === 'TV' || e.node.format === 'TV_SHORT' || e.node.format === 'ONA' || e.node.format === 'MOVIE') // sometimes movies are prequels/sequels (Demon Slayer)
  );
  
  if (prequels.length > 0) {
    const parentId = prequels[0].node.id;
    const parent = await findCanonicalParent(parentId, visited);
    return parent || media;
  }
  return media;
}
(async () => {
  const s2Id = 145064; 
  const parent = await findCanonicalParent(s2Id);
  console.log("Parent JJK:", parent?.title?.english);
})();
