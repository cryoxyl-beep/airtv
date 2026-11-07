import { useId } from "react";

/**
 * Miyoro loading animation: the み logo fills up with waves, then loops.
 * Colour follows the surrounding text colour (currentColor), so it works in
 * light and dark themes. Pass `color` to override.
 *
 *   <MiyoroLoader size={96} />
 *   <MiyoroLoader size={160} color="#F5F5F5" />
 */
const css = `.ml-fillwrap{animation:ml-fade 3.6s linear infinite}
.ml-water{animation:ml-rise 3.6s infinite}
.ml-w1{animation:ml-slide-a 1.7s linear infinite}
.ml-w2{animation:ml-slide-b 2.4s linear infinite}
@keyframes ml-rise{
  0%{transform:translateY(484px);animation-timing-function:cubic-bezier(.33,.0,.67,1)}
  76%{transform:translateY(32px)}
  100%{transform:translateY(32px)}
}
@keyframes ml-fade{0%{opacity:1}88%{opacity:1}98%{opacity:0}100%{opacity:0}}
@keyframes ml-slide-a{from{transform:translateX(0)}to{transform:translateX(256px)}}
@keyframes ml-slide-b{from{transform:translateX(0)}to{transform:translateX(-256px)}}
@media (prefers-reduced-motion:reduce){
  .ml-fillwrap,.ml-w1,.ml-w2{animation:none}
  .ml-water{animation:none;transform:translateY(32px)}
}`;

export default function MiyoroLoader({ size = 96, color }) {
  const id = useId().replace(/:/g, "");
  return (
    <>
      <style>{css}</style>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size} role="img" aria-label="Loading" style={{ color }} className="ml-ink">
  
  <defs>
    <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <path fill="#fff" stroke="#fff" strokeWidth="37.1" strokeLinejoin="round" transform="translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)" d="M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z"/>
    </mask>
  </defs>
  <g opacity=".14">
    <path fill="currentColor" stroke="currentColor" strokeWidth="37.1" strokeLinejoin="round" transform="translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)" d="M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z"/>
  </g>
  <g mask={`url(#${id}-m)`}>
    <g className="ml-fillwrap">
      <g className="ml-water">
        <g className="ml-w2" opacity=".38"><path fill="currentColor" transform="translate(0 -13)" d="M-512 0 q64 -28 128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 L1024 700 L-512 700 Z"/></g>
        <g className="ml-w1"><path fill="currentColor" d="M-512 0 q64 -28 128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 L1024 700 L-512 700 Z"/></g>
      </g>
    </g>
  </g>
</svg>
    </>
  );
}
