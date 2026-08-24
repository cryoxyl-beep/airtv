const fs = require('fs');

let appContent = fs.readFileSync('src/App.tsx', 'utf8');
appContent = appContent.replace(
  `        // Just focus the input wherever they are
        const input = document.querySelector('input[name="search"]');
        if (input) (input as HTMLElement).focus();`,
  `        // Dispatch custom event to let Navbar handle focusing and visibility
        window.dispatchEvent(new CustomEvent('focus-search'));`
);
fs.writeFileSync('src/App.tsx', appContent, 'utf8');

let navContent = fs.readFileSync('src/components/Navbar.tsx', 'utf8');
const hookTarget = `  useEffect(() => {
    const handleScroll = () => {`;
const hookReplacement = `  useEffect(() => {
    const handleFocusSearch = () => {
      setIsVisible(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        const input = document.querySelector('input[name="search"]');
        if (input) (input as HTMLElement).focus();
      }, 300);
    };
    window.addEventListener('focus-search', handleFocusSearch);
    return () => window.removeEventListener('focus-search', handleFocusSearch);
  }, []);

  useEffect(() => {
    const handleScroll = () => {`;
navContent = navContent.replace(hookTarget, hookReplacement);
fs.writeFileSync('src/components/Navbar.tsx', navContent, 'utf8');
