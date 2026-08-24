const fs = require('fs');
let content = fs.readFileSync('src/components/EpisodeList.tsx', 'utf8');

content = content.replace(
`export default function EpisodeList({ episodes, currentEpisode, onEpisodeSelect }: EpisodeListProps) {`,
`export default function EpisodeList({ episodes, currentEpisode, onEpisodeSelect, isAnime }: EpisodeListProps) {`);

fs.writeFileSync('src/components/EpisodeList.tsx', content, 'utf8');
