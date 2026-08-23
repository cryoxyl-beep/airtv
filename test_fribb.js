const fs = require('fs');
fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json')
  .then(r => r.json())
  .then(data => {
    console.log("Length:", data.length);
    console.log("First item:", data[0]);
  })
  .catch(console.error);
