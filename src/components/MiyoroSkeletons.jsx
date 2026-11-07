/**
 * Skeleton loading placeholders with a soft shimmer. They use neutral grey with
 * transparency, so they look right on both dark and light backgrounds.
 *
 *   <SkeletonGrid count={12} />          // grid of anime cards
 *   <SkeletonRow count={8} />            // horizontal row (home page rails)
 *   <SkeletonEpisodeList count={6} />    // episode list on the watch page
 *   <SkeletonHero />                     // big banner at the top
 *   <SkeletonCard />                     // a single card
 */
const css = `.mk-sk{position:relative;overflow:hidden;background:linear-gradient(100deg,rgba(128,128,128,.14) 30%,rgba(128,128,128,.28) 50%,rgba(128,128,128,.14) 70%);background-size:300% 100%;animation:mk-shimmer 1.7s linear infinite}
@keyframes mk-shimmer{from{background-position:100% 0}to{background-position:-100% 0}}
.mk-card{display:flex;flex-direction:column;gap:10px;min-width:0}
.mk-poster{aspect-ratio:2/3;border-radius:14px;display:grid;place-items:center}
.mk-poster svg{width:24%;height:auto;opacity:.16;color:currentColor}
.mk-line{height:12px;border-radius:6px}
.mk-grid{display:grid;gap:18px 16px}
.mk-row{display:flex;gap:16px;overflow:hidden}
.mk-ep{display:flex;gap:14px;align-items:center}
.mk-ep-thumb{aspect-ratio:16/9;width:132px;flex-shrink:0;border-radius:10px}
.mk-ep-text{flex:1;display:flex;flex-direction:column;gap:9px;min-width:0}
.mk-hero{width:100%;aspect-ratio:21/9;min-height:200px;border-radius:20px;display:flex;flex-direction:column;justify-content:flex-end;gap:12px;padding:clamp(16px,3vw,36px);box-sizing:border-box}
.mk-hero .mk-line{background:rgba(128,128,128,.25)}
@media (prefers-reduced-motion:reduce){.mk-sk{animation:none}}`;

const D = "M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z";
const TF = "translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)";

function Styles() {
  return <style>{css}</style>;
}

function Mark() {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" stroke="currentColor" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
    </svg>
  );
}

export function SkeletonCard({ style }) {
  return (
    <div className="mk-card" style={style} aria-hidden="true">
      <Styles />
      <div className="mk-sk mk-poster">
        <Mark />
      </div>
      <div className="mk-sk mk-line" style={{ width: "82%" }} />
      <div className="mk-sk mk-line" style={{ width: "48%", height: 10 }} />
    </div>
  );
}

export function SkeletonGrid({ count = 12, minWidth = 150, style }) {
  return (
    <div
      className="mk-grid"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, ...style }}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonRow({ count = 8, cardWidth = 150, style }) {
  return (
    <div className="mk-row" style={style} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} style={{ width: cardWidth, flexShrink: 0 }} />
      ))}
    </div>
  );
}

export function SkeletonEpisodeList({ count = 6, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, ...style }} role="status" aria-label="Loading">
      <Styles />
      {Array.from({ length: count }, (_, i) => (
        <div className="mk-ep" key={i} aria-hidden="true">
          <div className="mk-sk mk-ep-thumb" />
          <div className="mk-ep-text">
            <div className="mk-sk mk-line" style={{ width: "62%" }} />
            <div className="mk-sk mk-line" style={{ width: "86%", height: 10 }} />
            <div className="mk-sk mk-line" style={{ width: "34%", height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonHero({ style }) {
  return (
    <div className="mk-sk mk-hero" style={style} role="status" aria-label="Loading">
      <Styles />
      <div className="mk-line" style={{ width: "min(46%,420px)", height: 26, borderRadius: 10 }} />
      <div className="mk-line" style={{ width: "min(62%,560px)" }} />
      <div className="mk-line" style={{ width: "min(38%,340px)" }} />
    </div>
  );
}
