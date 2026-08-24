const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add SearchPage import
content = content.replace(
  "import BrowsePage from './pages/BrowsePage';",
  "import BrowsePage from './pages/BrowsePage';\nimport SearchPage from './pages/SearchPage';"
);

// Add Route
content = content.replace(
  "<Route path=\"/browse/:platform\" element={<BrowsePage />} />",
  "<Route path=\"/browse/:platform\" element={<BrowsePage />} />\n        <Route path=\"/search\" element={<SearchPage />} />"
);

// Add GlobalShortcut component
const globalShortcut = `
import { useNavigate } from 'react-router-dom';

function GlobalShortcuts() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        
        // If already on search page, just focus input
        if (window.location.pathname === '/search') {
          const input = document.querySelector('input[type="text"]');
          if (input) (input as HTMLElement).focus();
        } else {
          navigate('/search');
        }
      }
      
      // Escape to close if on search
      if (e.key === 'Escape' && window.location.pathname === '/search') {
        navigate(-1); // go back
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return null;
}
`;

content = content.replace("function ScrollManager() {", globalShortcut + "\nfunction ScrollManager() {");

content = content.replace("<ScrollManager />", "<ScrollManager />\n      <GlobalShortcuts />");

fs.writeFileSync('src/App.tsx', content, 'utf8');
