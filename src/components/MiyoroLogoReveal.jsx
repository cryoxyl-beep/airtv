/**
 * Logo reveal: the outline of the み draws itself, fills in, and settles with a
 * tiny pop. Plays once. To replay it, change the `key`:
 *
 *   <LogoReveal size={160} onDone={() => console.log("done")} />
 *   <LogoReveal key={replayCount} />
 *
 * Colour follows the surrounding text colour (currentColor).
 */
const css = `.lr-line{stroke-dasharray:1;stroke-dashoffset:1;animation:lr-draw 1.25s cubic-bezier(.65,0,.35,1) forwards,lr-line-out .35s ease 1.2s forwards}
.lr-fill{opacity:0;transform-origin:256px 256px;animation:lr-fill .55s ease 1.1s forwards,lr-pop .55s cubic-bezier(.3,1.5,.5,1) 1.1s forwards}
@keyframes lr-draw{to{stroke-dashoffset:0}}
@keyframes lr-line-out{to{opacity:0}}
@keyframes lr-fill{to{opacity:1}}
@keyframes lr-pop{0%{transform:scale(.93)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){
  .lr-line{display:none}
  .lr-fill{animation:none;opacity:1}
}`;

const D = "M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z";
const TF = "translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)";

export function LogoReveal({ size = 160, color, onDone }) {
  return (
    <>
      <style>{css}</style>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        role="img"
        aria-label="Miyoro"
        style={{ color }}
      >
        <path
          className="lr-line"
          pathLength="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinejoin="round"
          strokeLinecap="round"
          transform={TF}
          d={D}
        />
        <g
          className="lr-fill"
          onAnimationEnd={(e) => {
            if (e.animationName === "lr-pop" && onDone) onDone();
          }}
        >
          <path fill="currentColor" stroke="currentColor" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
        </g>
      </svg>
    </>
  );
}

export default LogoReveal;
