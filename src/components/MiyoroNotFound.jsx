import { useId } from "react";

/**
 * 404 page: "4 み 4", where the み is an almost empty glass with a little water
 * sloshing at the bottom. Colour follows the surrounding text colour.
 *
 *   <NotFound />                              // plain link back to "/"
 *   <NotFound onHome={() => navigate("/")} /> // with your router (react-router etc.)
 */
const css = `.nf-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:48px 20px;min-height:min(78vh,720px);box-sizing:border-box}
.nf-art{width:min(540px,88vw);height:auto;overflow:visible}
.nf-title{margin:14px 0 0;font-size:clamp(22px,3.4vw,30px);font-weight:700;letter-spacing:-.01em}
.nf-desc{margin:0;max-width:420px;opacity:.64;font-size:15px;line-height:1.55}
.nf-btn{margin-top:16px;display:inline-flex;align-items:center;gap:8px;padding:11px 26px;border-radius:999px;border:1.5px solid currentColor;color:inherit;text-decoration:none;font-weight:600;font-size:14px;background:transparent;cursor:pointer;transition:background .2s}
.nf-btn:hover{background:color-mix(in srgb,currentColor 12%,transparent)}
.nf-water{transform:translateY(372px);animation:nf-bob 3.2s ease-in-out infinite alternate}
.nf-w1{animation:nf-a 2.8s linear infinite}
.nf-w2{animation:nf-b 3.8s linear infinite}
@keyframes nf-bob{from{transform:translateY(380px)}to{transform:translateY(360px)}}
@keyframes nf-a{from{transform:translateX(0)}to{transform:translateX(256px)}}
@keyframes nf-b{from{transform:translateX(0)}to{transform:translateX(-256px)}}
@media (prefers-reduced-motion:reduce){.nf-water,.nf-w1,.nf-w2{animation:none}}`;

const D = "M885 524 726 542C730 510 730 467 727 423L726 412C669 436 607 455 541 467C575 547 609 626 634 668C642 682 656 697 672 714L576 789C556 781 525 774 497 772C448 768 356 765 296 765C274 765 236 767 208 770L214 615C241 619 280 623 300 624C345 627 412 629 452 630C433 591 409 533 385 477C182 465 38 343 38 185C38 73 110 9 205 9C283 9 335 41 378 107C412 162 449 251 484 334C559 322 629 295 693 261C658 178 589 90 443 27L573 -78C699 -11 774 72 820 177C847 156 872 135 896 113L966 282C939 300 906 321 867 343C876 399 882 459 885 524ZM323 335C301 283 279 235 259 203C242 179 230 169 212 169C193 169 179 182 179 209C179 260 231 316 323 335Z";
const TF = "translate(256 256) scale(0.4310 -0.4310) translate(-502.0 -355.5)";
const WAVE = "M-512 0 q64 -28 128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 t128 0 L1024 700 L-512 700 Z";

export function NotFound({
  homeHref = "/",
  onHome,
  title = "Page not found",
  description = "This page drifted away, or it never existed.",
  buttonText = "Back to home",
}) {
  const id = useId().replace(/:/g, "");
  const handle = onHome
    ? (e) => {
        e.preventDefault();
        onHome();
      }
    : undefined;
  return (
    <section className="nf-wrap">
      <style>{css}</style>
      <svg className="nf-art" viewBox="-10 -10 862 320" role="img" aria-label="404">
        <path fill="currentColor" transform="translate(0.0 300) scale(0.42493 -0.42493) translate(-21 0)" d="M21 245 253 706H424L210 290H354V437H508V290H587V157H508V0H354V157H21Z" />
        <path fill="currentColor" transform="translate(601.3 300) scale(0.42493 -0.42493) translate(-21 0)" d="M21 245 253 706H424L210 290H354V437H508V290H587V157H508V0H354V157H21Z" />
        <svg x="230.9" y="-40.0" width="380" height="380" viewBox="0 0 512 512" overflow="visible">
          <defs>
            <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
              <path fill="#fff" stroke="#fff" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
            </mask>
          </defs>
          <g opacity=".26">
            <path fill="currentColor" stroke="currentColor" strokeWidth="37.1" strokeLinejoin="round" transform={TF} d={D} />
          </g>
          <g mask={`url(#${id}-m)`}>
            <g className="nf-water">
              <g className="nf-w2" opacity=".38">
                <path fill="currentColor" transform="translate(0 -13)" d={WAVE} />
              </g>
              <g className="nf-w1">
                <path fill="currentColor" d={WAVE} />
              </g>
            </g>
          </g>
        </svg>
      </svg>
      <h1 className="nf-title">{title}</h1>
      <p className="nf-desc">{description}</p>
      <a className="nf-btn" href={homeHref} onClick={handle}>
        {buttonText}
      </a>
    </section>
  );
}

export default NotFound;
