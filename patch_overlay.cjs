const fs = require('fs');

let c = fs.readFileSync('src/components/EpisodeOverlay.tsx', 'utf8');

const hookLogic = `
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const dragDistance = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    dragDistance.current = 0;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
    dragDistance.current = Math.abs(x - startX.current);
  };

  const handleEpisodeClick = (episode_number: number) => {
    if (dragDistance.current > 5) return;
    onEpisodeSelect(episode_number);
  };
`;

c = c.replace(/const episodes = seasonData\?.episodes \|\| \[\];/, hookLogic + '\n  const episodes = seasonData?.episodes || [];');

c = c.replace(/ref=\{scrollRef\}\n\s*className="flex gap-4 overflow-x-auto pb-6 pt-2 px-2 snap-x scrollbar-hide"/, `ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-6 pt-2 px-2 scrollbar-hide cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}`);

c = c.replace(/onClick=\{\(\) => onEpisodeSelect\(episode.episode_number\)\}/, `onClick={() => handleEpisodeClick(episode.episode_number)}`);

c = c.replace(/className=\{\`flex-none w-64 md:w-72 flex flex-col gap-3 group cursor-pointer snap-start transition-all duration-300 hover:scale-105 \$\{isActive \? 'scale-105' : ''\}\`\}/g, `className={\`flex-none w-64 md:w-72 flex flex-col gap-3 group transition-all duration-300 hover:scale-105 \${isActive ? 'scale-105' : ''}\`}`);

// also add draggable={false} to the episode image to prevent native drag and drop interfering
c = c.replace(/loading="lazy"\n\s*\/>/g, `loading="lazy" draggable={false} />`);

fs.writeFileSync('src/components/EpisodeOverlay.tsx', c);
