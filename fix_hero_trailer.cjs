const fs = require('fs');

let content = fs.readFileSync('src/components/Hero.tsx', 'utf8');

// Add a ref to the iframe
if (!content.includes("const iframeRef = useRef<HTMLIFrameElement>(null);")) {
  content = content.replace(
    "const navigate = useNavigate();",
    "const navigate = useNavigate();\n  const iframeRef = React.useRef<HTMLIFrameElement>(null);"
  );
  
  content = content.replace(
    "<iframe\n              id=\"hero-trailer-player\"",
    "<iframe\n              ref={iframeRef}\n              id=\"hero-trailer-player\""
  );
  
  // Clean up on unmount
  content = content.replace(
    "window.removeEventListener('message', handleMessage);\n    };\n  }, [activeIndex, items]);",
    "window.removeEventListener('message', handleMessage);\n      if (iframeRef.current && iframeRef.current.contentWindow) {\n        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');\n        iframeRef.current.src = 'about:blank';\n      }\n    };\n  }, [activeIndex, items]);"
  );
}

fs.writeFileSync('src/components/Hero.tsx', content);
console.log('Fixed Hero trailer cleanup');
