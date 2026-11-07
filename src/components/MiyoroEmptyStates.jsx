/**
 * Empty / error states in the same minimal line style as the Miyoro icons.
 * Colour follows the surrounding text colour (currentColor).
 *
 *   <EmptyState variant="search" />                      // no search results
 *   <EmptyState variant="list" action={<button>Browse</button>} />
 *   <EmptyState variant="history" title="Nothing watched yet" />
 *   <EmptyState variant="offline" />
 *   <EmptyState variant="error" action={<button onClick={retry}>Try again</button>} />
 */
const css = `.es-wrap{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:40px 20px;box-sizing:border-box}
.es-art{display:block;animation:es-float 4.2s ease-in-out infinite}
.es-twinkle{animation:es-twinkle 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.es-twinkle.b{animation-delay:1.3s}
.es-title{margin:14px 0 0;font-size:18px;font-weight:700;letter-spacing:-.01em}
.es-desc{margin:0;max-width:340px;opacity:.62;font-size:14px;line-height:1.55}
.es-action{margin-top:16px}
@keyframes es-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes es-twinkle{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}
@media (prefers-reduced-motion:reduce){.es-art,.es-twinkle{animation:none}}`;

const COPY = {
  search: ["No results found", "Try a different spelling or fewer keywords."],
  list: ["Nothing here yet", "Anime you save will show up here."],
  history: ["No watch history", "Start an episode and it will appear here."],
  offline: ["You're offline", "Check your connection and try again."],
  error: ["Something went wrong", "We couldn't load this. Try again in a moment."],
};

const Sparkle = ({ x, y, r = 6, b }) => (
  <path className={`es-twinkle${b ? " b" : ""}`} d={`M${x} ${y - r} V${y + r} M${x - r} ${y} H${x + r}`} />
);

function Art({ variant }) {
  switch (variant) {
    case "list":
      return (
        <>
          <rect x="58" y="34" width="62" height="82" rx="11" strokeDasharray="1 7" opacity=".5" />
          <rect x="44" y="46" width="62" height="82" rx="11" strokeDasharray="1 7" />
          <path d="M75 78 V98 M65 88 H85" />
          <Sparkle x={122} y={46} />
          <Sparkle x={34} y={112} r={5} b />
        </>
      );
    case "history":
      return (
        <>
          <circle cx="76" cy="76" r="40" />
          <path d="M76 52 V76 L92 86" />
          <circle cx="119" cy="119" r="17" fill="currentColor" fillOpacity=".12" />
          <path d="M114 111 V127 L127 119 Z" fill="currentColor" />
          <Sparkle x={124} y={36} />
          <Sparkle x={30} y={118} r={5} b />
        </>
      );
    case "offline":
      return (
        <>
          <path d="M40 68 a58 58 0 0 1 80 0" />
          <path d="M54 84 a38 38 0 0 1 52 0" />
          <path d="M67 99 a19 19 0 0 1 26 0" />
          <circle cx="80" cy="114" r="4.2" fill="currentColor" stroke="none" />
          <path d="M44 40 L116 124" />
          <Sparkle x={126} y={52} r={5} />
          <Sparkle x={32} y={118} r={5} b />
        </>
      );
    case "error":
      return (
        <>
          <rect x="34" y="42" width="92" height="66" rx="14" />
          <path d="M80 62 V80" />
          <circle cx="80" cy="92" r="3.4" fill="currentColor" stroke="none" />
          <path d="M60 126 H100" />
          <Sparkle x={134} y={40} r={5} />
          <Sparkle x={26} y={110} r={5} b />
        </>
      );
    case "search":
    default:
      return (
        <>
          <circle cx="72" cy="70" r="36" />
          <path d="M98 96 L124 122" strokeWidth="5" />
          <path d="M54 72 q9 -8 18 0 t18 0" />
          <path d="M60 86 q6 -5 12 0 t12 0" opacity=".4" />
          <Sparkle x={122} y={44} />
          <Sparkle x={32} y={116} r={5} b />
        </>
      );
  }
}

export function EmptyState({ variant = "search", title, description, action, size = 160, style }) {
  const [t, d] = COPY[variant] || COPY.search;
  return (
    <div className="es-wrap" style={style} role="status">
      <style>{css}</style>
      <svg
        className="es-art"
        width={size}
        height={size}
        viewBox="0 0 160 160"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="80" cy="80" r="66" fill="currentColor" fillOpacity=".06" stroke="none" />
        <Art variant={variant} />
      </svg>
      <h3 className="es-title">{title ?? t}</h3>
      <p className="es-desc">{description ?? d}</p>
      {action ? <div className="es-action">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
