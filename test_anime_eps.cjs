const episodes = [
  { title: "Episode 15 - The Last Stand", thumbnail: "foo.jpg" },
  { title: "16 - New Beginning", thumbnail: "bar.jpg" }
];

episodes.forEach(ep => {
  let epNum = null;
  const match = ep.title.match(/Episode\s+(\d+)|^\s*(\d+)\s*-/i);
  if (match) {
    epNum = parseInt(match[1] || match[2], 10);
  }
  console.log(ep.title, '->', epNum);
});
