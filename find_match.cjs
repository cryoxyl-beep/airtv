const fs = require('fs');

// Simple regex tag tokenizer to build DOM tree of an HTML string
function parseHTML(html) {
  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const tagRegex = /<\/?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    if (match[3]) continue; // text
    const isClosing = match[0].startsWith('</');
    const isSelfClosing = match[0].endsWith('/>') || ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(match[1].toLowerCase());
    const tagName = match[1].toLowerCase();
    const rawAttrs = match[2];

    if (isClosing) {
      if (stack.length > 1 && stack[stack.length - 1].tag === tagName) {
        stack.pop();
      }
    } else {
      const node = { tag: tagName, rawAttrs: rawAttrs, children: [], text: '' };
      stack[stack.length - 1].children.push(node);
      if (!isSelfClosing) {
        stack.push(node);
      }
    }
  }
  return root;
}

function getSelectorPath(node, path = []) {
  //
}
