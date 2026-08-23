export interface AnimeGroup {
  groupId: number; // canonical AniList ID (usually the earliest season)
  title: string;
  seasons: {
    anilistId: number;
    seasonNumber: number;
    displayTitle: string;
    startDate: any;
    format: string;
    coverImage: any;
    episodes: number;
  }[];
}

export const groupCache = new Map<number, AnimeGroup>();
export const nodeCache = new Map<number, any>();

// Helper to determine if a format is considered a main series format
const isMainFormat = (format: string) => ['TV', 'TV_SHORT', 'ONA', 'SPECIAL'].includes(format);

// Helper to extract all seasons from a 2-level relation tree
export const buildAnimeGroup = (media: any): AnimeGroup | null => {
  if (!media || !media.relations) return null;

  // Check cache first
  if (groupCache.has(media.id)) return groupCache.get(media.id)!;

  const nodes = new Map<number, any>();
  const addNode = (n: any) => {
    if (n && n.type === 'ANIME' && isMainFormat(n.format)) {
      nodes.set(n.id, n);
      if (!nodeCache.has(n.id)) nodeCache.set(n.id, n);
    }
  };

  addNode(media);

  let sourceNode = null;
  for (const edge of (media.relations?.edges || [])) {
    if (edge.relationType === 'ADAPTATION' && ['MANGA', 'NOVEL', 'LIGHT_NOVEL'].includes(edge.node?.type)) {
      sourceNode = edge.node;
      break;
    }
  }

  if (sourceNode && sourceNode.relations) {
    for (const edge of sourceNode.relations.edges) {
      if (edge.relationType === 'ADAPTATION' && edge.node?.type === 'ANIME') {
        addNode(edge.node);
      }
    }
  }

  const adj = new Map<number, number[]>();
  const addEdge = (a: any, b: any, type: string) => {
    if (type !== 'PREQUEL' && type !== 'SEQUEL') return;
    if (a.type !== 'ANIME' || b.type !== 'ANIME') return;
    
    if (!isMainFormat(a.format) || !isMainFormat(b.format)) return;

    addNode(a);
    addNode(b);
    
    if (!adj.has(a.id)) adj.set(a.id, []);
    if (!adj.has(b.id)) adj.set(b.id, []);
    adj.get(a.id)!.push(b.id);
    adj.get(b.id)!.push(a.id);
  };

  for (const edge of (media.relations?.edges || [])) {
    if (edge.node) {
      addEdge(media, edge.node, edge.relationType);
      if (edge.node.relations) {
        for (const subEdge of edge.node.relations.edges) {
          if (subEdge.node) {
             addEdge(edge.node, subEdge.node, subEdge.relationType);
          }
        }
      }
    }
  }

  const visited = new Set<number>();
  const queue = [media.id];
  visited.add(media.id);
  
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const neighbor of (adj.get(cur) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const franchiseIds = new Set([...Array.from(visited), ...Array.from(nodes.keys())]);
  
  const seasons = Array.from(franchiseIds)
    .map(id => nodes.get(id))
    .filter(n => n)
    .sort((a, b) => {
      const dateA = new Date(a.startDate?.year || 9999, (a.startDate?.month || 1)-1, a.startDate?.day || 1).getTime();
      const dateB = new Date(b.startDate?.year || 9999, (b.startDate?.month || 1)-1, b.startDate?.day || 1).getTime();
      return dateA - dateB;
    });

  if (seasons.length <= 1) {
    return null;
  }

  const canonical = seasons[0];
  
  const group: AnimeGroup = {
    groupId: canonical.id,
    title: canonical.title?.english || canonical.title?.romaji || canonical.title?.native,
    seasons: seasons.map((s, index) => ({
      anilistId: s.id,
      seasonNumber: index + 1,
      displayTitle: s.title?.english || s.title?.romaji || s.title?.native,
      startDate: s.startDate,
      format: s.format,
      coverImage: s.coverImage,
      episodes: s.episodes
    }))
  };

  for (const s of seasons) {
    groupCache.set(s.id, group);
  }

  return group;
};
