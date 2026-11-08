/**
 * Skeleton for the HERO banner at the top of the home page.
 * Big shimmering banner, a pulsing Miyoro み in the middle, and placeholders
 * where the clear logo, the text and the buttons will be.
 *
 *   {loading ? <HeroSkeleton /> : <Hero />}
 *   <HeroSkeleton height="70vh" />     // optional fixed height
 */
const css = `.hs{position:relative;overflow:hidden;width:100%;aspect-ratio:21/9;min-height:280px;border-radius:14px;box-sizing:border-box;background:linear-gradient(100deg,rgba(128,128,128,.14) 30%,rgba(128,128,128,.27) 50%,rgba(128,128,128,.14) 70%);background-size:300% 100%;animation:hs-shimmer 1.8s linear infinite}
.hs-fade{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.28),transparent 55%)}
.hs-mark{position:absolute;left:50%;top:42%;width:clamp(56px,9vw,120px);color:currentColor;transform:translate(-50%,-50%);opacity:.2;animation:hs-pulse 2.2s ease-in-out infinite}
.hs-mark svg{display:block;width:100%;height:auto}
.hs-info{position:absolute;left:clamp(18px,4vw,56px);bottom:clamp(18px,4vw,52px);width:min(46%,520px);display:flex;flex-direction:column;gap:12px}
.hs-bar{border-radius:8px;background:rgba(128,128,128,.34);animation:hs-bar 1.8s ease-in-out infinite}
.hs-logo{height:clamp(30px,5vw,64px);width:68%}
.hs-meta{height:12px;width:42%}
.hs-t1{height:12px;width:96%}
.hs-t2{height:12px;width:78%}
.hs-btns{display:flex;gap:12px;margin-top:6px}
.hs-btn{height:clamp(34px,3.4vw,44px);border-radius:999px}
@keyframes hs-shimmer{from{background-position:100% 0}to{background-position:-100% 0}}
@keyframes hs-pulse{0%,100%{opacity:.12;transform:translate(-50%,-50%) scale(.96)}50%{opacity:.32;transform:translate(-50%,-50%) scale(1.03)}}
@keyframes hs-bar{0%,100%{opacity:.6}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.hs,.hs-mark,.hs-bar{animation:none}}`;

const D = "M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z";
const TF = "translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)";

export function HeroSkeleton({ height, style }) {
  return (
    <div className="hs" style={{ ...(height ? { height, aspectRatio: "auto" } : null), ...style }} role="status" aria-label="Loading">
      <style>{css}</style>
      <div className="hs-fade" />
      <div className="hs-mark" aria-hidden="true">
        <svg viewBox="0 0 512 512">
          <path fill="currentColor" stroke="currentColor" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
        </svg>
      </div>
      <div className="hs-info" aria-hidden="true">
        <div className="hs-bar hs-logo" />
        <div className="hs-bar hs-meta" />
        <div className="hs-bar hs-t1" />
        <div className="hs-bar hs-t2" />
        <div className="hs-btns">
          <div className="hs-bar hs-btn" style={{ width: 128 }} />
          <div className="hs-bar hs-btn" style={{ width: 44 }} />
        </div>
      </div>
    </div>
  );
}

export default HeroSkeleton;
