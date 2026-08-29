const fs = require('fs');

let content = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');

content = content.replace(
  "window.removeEventListener('message', handleMessage);\n    };",
  "window.removeEventListener('message', handleMessage);\n      if (iframeRef.current && iframeRef.current.contentWindow) {\n        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');\n        iframeRef.current.src = 'about:blank';\n      }\n    };"
);

fs.writeFileSync('src/components/WatchPage.tsx', content);
console.log('Fixed WatchPage trailer cleanup');
