const fs = require('fs');

let c = fs.readFileSync('src/components/WatchPage.tsx', 'utf8');

// Update Props interface
c = c.replace(/isProviderActive\?: boolean;\n\s*providerIframeUrl\?: string \| null;\n\s*onToggleEpisodes\?: \(\) => void;\n/, "");

// Update function signature
c = c.replace(/export default function WatchPage\(\{ item, type, seasonNumber, episodeNumber, seasonData, forceFullScreen, onPlay, isProviderActive, providerIframeUrl, onToggleEpisodes \}: WatchPageProps\) \{ console\.log\('WatchPageContent rendered with providerIframeUrl:', providerIframeUrl\);/, "export default function WatchPage({ item, type, seasonNumber, episodeNumber, seasonData, forceFullScreen, onPlay }: WatchPageProps) {");

// Remove useEffects related to isProviderActive
c = c.replace(/useEffect\(\(\) => \{\n\s*if \(isProviderActive\) \{\n\s*setTrailerEnded\(true\);[\s\S]*?\}, \[isProviderActive\]\);\n\n/, "");

// Clean up trailer condition
c = c.replace(/\{trailerKey && !trailerEnded && !isProviderActive && \(/, "{trailerKey && !trailerEnded && (");

// Remove iframe layer 3
c = c.replace(/\{\/\* Layer 3: Provider iframe \*\/\}[\s\S]*?\{isProviderActive && providerIframeUrl && \([\s\S]*?<\/iframe>[\s\S]*?\{type !== 'movie' && \([\s\S]*?<\/button>\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}/, "");

fs.writeFileSync('src/components/WatchPage.tsx', c);
