const fs = require('fs');
let content = fs.readFileSync('src/pages/WatchPage.tsx', 'utf8');

const returnStatementTarget = `  return (
    <div className={\`min-h-screen bg-[#0b0b0b] font-sans text-white \${(type === 'tv' || type === 'anime') ? 'pb-20' : 'overflow-hidden'}\`}>
      {/* Top Nav (Minimal) */}`;

const returnStatementReplacement = `  const showBottomSection = ((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 1) || (type === 'anime' && data?.animeGroup && data.animeGroup.seasons && data.animeGroup.seasons.length > 1));

  return (
    <div className={\`min-h-screen bg-[#0b0b0b] font-sans text-white \${showBottomSection ? 'pb-20' : 'overflow-hidden'}\`}>
      {/* Top Nav (Minimal) */}`;

content = content.replace(returnStatementTarget, returnStatementReplacement);

const watchPlayerTarget = `      <div className="w-full relative bg-black pt-0 lg:pt-0">
        <WatchPlayer 
          item={data} 
          type={type} 
          seasonNumber={(type === 'tv' || type === 'anime') ? seasonNumber : undefined}
          episodeNumber={(type === 'tv' || type === 'anime') ? episodeNumber : undefined}
          seasonData={(type === 'tv' || type === 'anime') ? seasonData : undefined}
        />
      </div>`;

const watchPlayerReplacement = `      <div className="w-full relative bg-black pt-0 lg:pt-0">
        <WatchPlayer 
          item={data} 
          type={type} 
          seasonNumber={(type === 'tv' || type === 'anime') ? seasonNumber : undefined}
          episodeNumber={(type === 'tv' || type === 'anime') ? episodeNumber : undefined}
          seasonData={(type === 'tv' || type === 'anime') ? seasonData : undefined}
          forceFullScreen={!showBottomSection}
        />
      </div>`;

content = content.replace(watchPlayerTarget, watchPlayerReplacement);

const detailsTarget = `{((type === 'tv' && data.seasons && seasonData) || (type === 'anime' && seasonData?.episodes?.length > 1)) && (
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 pb-10 pt-2 md:pt-4">`;

const detailsReplacement = `{showBottomSection && (
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 pb-10 pt-2 md:pt-4">`;

content = content.replace(detailsTarget, detailsReplacement);

fs.writeFileSync('src/pages/WatchPage.tsx', content, 'utf8');

// Now for WatchPlayer.tsx
let playerContent = fs.readFileSync('src/components/WatchPlayer.tsx', 'utf8');
playerContent = playerContent.replace(/seasonData\?: any;/g, "seasonData?: any;\n  forceFullScreen?: boolean;");
playerContent = playerContent.replace(/export default function WatchPlayer\(\{ item, type, seasonNumber, episodeNumber, seasonData \}: WatchPlayerProps\) \{/g, "export default function WatchPlayer({ item, type, seasonNumber, episodeNumber, seasonData, forceFullScreen }: WatchPlayerProps) {");
playerContent = playerContent.replace(/className=\{\`relative w-full bg-black overflow-hidden group \$\{type === 'movie' \? 'h-screen' : 'aspect-video md:aspect-\[21\/9\] lg:aspect-\[21\/9\] xl:aspect-\[24\/9\]'\}\`\}/g, "className={`relative w-full bg-black overflow-hidden group ${type === 'movie' || forceFullScreen ? 'h-screen' : 'aspect-video md:aspect-[21/9] lg:aspect-[21/9] xl:aspect-[24/9]'}`}");
fs.writeFileSync('src/components/WatchPlayer.tsx', playerContent, 'utf8');
