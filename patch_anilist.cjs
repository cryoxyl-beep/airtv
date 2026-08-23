const fs = require('fs');
let content = fs.readFileSync('src/api/anilist.ts', 'utf8');

const relationsQuery = `
        relations {
          edges {
            relationType
            node {
              id
              title { romaji english native }
              description
              coverImage { extraLarge large }
              bannerImage
              averageScore
              startDate { year month day }
              status
              episodes
              genres
              trailer { id site }
              format
              type
              relations {
                edges {
                  relationType
                  node {
                    id
                    title { romaji english native }
                    description
                    coverImage { extraLarge large }
                    bannerImage
                    averageScore
                    startDate { year month day }
                    status
                    episodes
                    genres
                    trailer { id site }
                    format
                    type
                  }
                }
              }
            }
          }
        }`;

// Replace the query fields with the new ones
content = content.replace(/trailer \{ id site \}/g, `trailer { id site }${relationsQuery}`);
content = content.replace(/import \{ resolveAnimeMapping, preloadFribbMapping \} from '\.\/fribb';/, "import { resolveAnimeMapping, preloadFribbMapping } from './fribb';\nimport { buildAnimeGroup, nodeCache, groupCache } from './anilistGroups';");

// Add deduplication logic at the end
const deduplicateLogic = `
export const deduplicateAnimeList = async (results: any[]) => {
  const seenFranchise = new Set<number>();
  const finalResults = [];
  
  for (const item of results) {
    if (!item || !item.anilist_raw) continue;
    const group = buildAnimeGroup(item.anilist_raw);
    const groupId = group ? group.groupId : item.id;
    
    if (!seenFranchise.has(groupId)) {
      seenFranchise.add(groupId);
      
      if (group && groupId !== item.id) {
        // Swap with canonical parent
        const canonicalRaw = nodeCache.get(groupId);
        if (canonicalRaw) {
          // ensure relations are copied over so we don't lose the group if someone clicks on the canonical item
          if (!canonicalRaw.relations) canonicalRaw.relations = item.anilist_raw.relations;
          const canonicalNorm = await normalizeAniListToTmdb(canonicalRaw);
          if (canonicalNorm) finalResults.push(canonicalNorm);
        } else {
          finalResults.push(item);
        }
      } else {
        finalResults.push(item);
      }
    }
  }
  return finalResults;
};
`;

content += deduplicateLogic;

// Update all endpoint returns to use deduplicateAnimeList
content = content.replace(/return \{ results: results\.filter\(Boolean\) \};/g, "return { results: await deduplicateAnimeList(results.filter(Boolean)) };");

fs.writeFileSync('src/api/anilist.ts', content, 'utf8');
