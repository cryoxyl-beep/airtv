/**
 * Skeletons for the home-screen LANDSCAPE (16:9) cards: wide thumbnail with a
 * pulsing Miyoro み, a placeholder where the HD clear logo sits, and text lines.
 *
 *   <LandscapeSkeletonRow count={6} />            // horizontal rail
 *   <LandscapeSkeletonGrid count={9} />           // grid of wide cards
 *   <LandscapeSkeleton />                         // single card
 *   <LandscapeSkeletonSection><LandscapeSkeletonRow /></LandscapeSkeletonSection>  // adds a heading bar
 *
 * Props: cardWidth (row), minWidth (grid), gap, text={false} to hide the text lines.
 */
const css = `.ls{position:relative;min-width:0}
.ls-thumb{position:relative;overflow:hidden;aspect-ratio:16/9;border-radius:10px;background:linear-gradient(100deg,rgba(128,128,128,.14) 30%,rgba(128,128,128,.27) 50%,rgba(128,128,128,.14) 70%);background-size:300% 100%;animation:ls-shimmer 1.8s linear infinite}
.ls-mark{position:absolute;left:50%;top:38%;width:15%;min-width:32px;max-width:70px;color:currentColor;transform:translate(-50%,-50%);opacity:.2;animation:ls-pulse 2.2s ease-in-out infinite}
.ls-mark svg{display:block;width:100%;height:auto}
.ls-logo{position:absolute;left:0;right:0;bottom:12%;display:flex;flex-direction:column;align-items:center;gap:7px}
.ls-bar{border-radius:7px;background:rgba(128,128,128,.34);animation:ls-bar 1.8s ease-in-out infinite}
.ls-logo .a{width:54%;height:clamp(14px,2.2vw,26px)}
.ls-logo .b{width:28%;height:clamp(5px,.7vw,8px);animation-delay:.2s}
.ls-text{display:flex;flex-direction:column;gap:8px;padding-top:10px}
.ls-text .a{height:12px;width:72%}
.ls-text .b{height:10px;width:46%;animation-delay:.2s}
.ls-row{display:flex;overflow:hidden}
.ls-grid{display:grid}
.ls-sec{height:20px;width:min(46%,320px);border-radius:7px;margin:0 0 14px;background:rgba(128,128,128,.2);animation:ls-bar 1.8s ease-in-out infinite}
@keyframes ls-shimmer{from{background-position:100% 0}to{background-position:-100% 0}}
@keyframes ls-pulse{0%,100%{opacity:.12;transform:translate(-50%,-50%) scale(.96)}50%{opacity:.3;transform:translate(-50%,-50%) scale(1.03)}}
@keyframes ls-bar{0%,100%{opacity:.6}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.ls-thumb,.ls-mark,.ls-bar,.ls-sec{animation:none}}`;

const D = "M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z";
const TF = "translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)";

export function LandscapeSkeleton({ text = false, style }) {
  return (
    <div className="ls" style={style} aria-hidden="true">
      <style>{css}</style>
      <div className="ls-thumb">
        <div className="ls-mark">
          <svg viewBox="0 0 512 512">
            <path fill="currentColor" stroke="currentColor" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
          </svg>
        </div>
        <div className="ls-logo">
          <div className="ls-bar a" />
          <div className="ls-bar b" />
        </div>
      </div>
      {text ? (
        <div className="ls-text">
          <div className="ls-bar a" />
          <div className="ls-bar b" />
        </div>
      ) : null}
    </div>
  );
}

export function LandscapeSkeletonRow({ count = 6, cardWidth = 300, gap = 20, text = false, style }) {
  return (
    <div className="ls-row" style={{ gap, ...style }} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <LandscapeSkeleton key={i} text={text} style={{ width: cardWidth, flexShrink: 0 }} />
      ))}
    </div>
  );
}

export function LandscapeSkeletonGrid({ count = 9, minWidth = 280, gap = 20, text = false, style }) {
  return (
    <div
      className="ls-grid"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap, ...style }}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <LandscapeSkeleton key={i} text={text} />
      ))}
    </div>
  );
}

export function LandscapeSkeletonSection({ children, style }) {
  return (
    <section style={style} aria-hidden="true">
      <style>{css}</style>
      <div className="ls-sec" />
      {children}
    </section>
  );
}

export default LandscapeSkeleton;
