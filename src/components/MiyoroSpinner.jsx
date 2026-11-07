import { useId } from "react";

/**
 * Small version of the Miyoro wave-fill loader, for buttons and tiny spots.
 * Colour follows the surrounding text colour (currentColor).
 *
 *   <MiyoroSpinner size={18} />
 *   <LoadingButton loading={saving} onClick={save}>Save</LoadingButton>
 */
const css = `.msp-fillwrap{animation:msp-fade 1.5s linear infinite}
.msp-water{animation:msp-rise 1.5s infinite}
.msp-w1{animation:msp-a .8s linear infinite}
.msp-w2{animation:msp-b 1.1s linear infinite}
@keyframes msp-rise{
  0%{transform:translateY(484px);animation-timing-function:cubic-bezier(.33,0,.67,1)}
  80%{transform:translateY(24px)}
  100%{transform:translateY(24px)}
}
@keyframes msp-fade{0%{opacity:1}86%{opacity:1}97%{opacity:0}100%{opacity:0}}
@keyframes msp-a{from{transform:translateX(0)}to{transform:translateX(256px)}}
@keyframes msp-b{from{transform:translateX(0)}to{transform:translateX(-256px)}}
@media (prefers-reduced-motion:reduce){
  .msp-fillwrap,.msp-w1,.msp-w2{animation:none}
  .msp-water{animation:none;transform:translateY(24px)}
}`;

const D = "M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z";
const TF = "translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)";
const WAVE = "M-512 0 q64 -44 128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 L1024 700 L-512 700 Z";

export function MiyoroSpinner({ size = 20, color, label = "Loading" }) {
  const id = useId().replace(/:/g, "");
  return (
    <>
      <style>{css}</style>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        role="status"
        aria-label={label}
        style={{ color, flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
      >
        <defs>
          <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
            <path fill="#fff" stroke="#fff" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
          </mask>
        </defs>
        <g opacity=".22">
          <path fill="currentColor" stroke="currentColor" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
        </g>
        <g mask={`url(#${id}-m)`}>
          <g className="msp-fillwrap">
            <g className="msp-water">
              <g className="msp-w2" opacity=".4">
                <path fill="currentColor" transform="translate(0 -18)" d={WAVE} />
              </g>
              <g className="msp-w1">
                <path fill="currentColor" d={WAVE} />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </>
  );
}

/**
 * A button that shows the spinner and disables itself while `loading` is true.
 * Pass className/style as usual so it keeps your button styling.
 */
export function LoadingButton({ loading = false, children, disabled, spinnerSize = 18, style, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, ...style }}
    >
      {loading && <MiyoroSpinner size={spinnerSize} />}
      {children}
    </button>
  );
}

export default MiyoroSpinner;
