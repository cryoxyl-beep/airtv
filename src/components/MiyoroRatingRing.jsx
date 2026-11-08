/**
 * Circular rating (0-10). The ring fills by the score and the colour follows it:
 *   7 and up  -> green     5 to 6.9 -> orange     under 5 -> red
 * Works on portrait and landscape posters (dark round backing, readable on any image).
 *
 *   <RatingRing value={7.3} />
 *   <RatingRing value={9.1} size={40} />
 *   <RatingRing value={4.2} corner="top-left" />   // placed on the corner of a poster
 *
 * Put it inside a poster wrapper that has position: relative.
 * Renders nothing when there is no rating (null, 0 or not a number).
 * For ratings out of 100 or 5, pass `max` (e.g. max={5}).
 */
const css = `.rr{display:inline-grid;place-items:center;position:relative;border-radius:50%;background:rgba(10,10,10,.74);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 1px 6px rgba(0,0,0,.35);flex-shrink:0;color:#f5f5f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-weight:700;line-height:1;letter-spacing:-.01em;user-select:none}
.rr svg{position:absolute;inset:0;transform:rotate(-90deg)}
.rr-ring{transition:none;animation:rr-draw .9s cubic-bezier(.3,.7,.2,1) both}
.rr-abs{position:absolute;z-index:2}
.rr-top-right{top:8px;right:8px}
.rr-top-left{top:8px;left:8px}
.rr-bottom-right{bottom:8px;right:8px}
.rr-bottom-left{bottom:8px;left:8px}
@keyframes rr-draw{from{stroke-dashoffset:var(--rr-c)}}
@media (prefers-reduced-motion:reduce){.rr-ring{animation:none}}`;

export function ratingColor(score10) {
  if (score10 >= 7) return "#34d27b"; // green
  if (score10 >= 5) return "#ffa23a"; // orange
  return "#ff4d4f"; // red
}

export function RatingRing({ value, max = 10, size = 34, corner, className = "", style }) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const score10 = Math.max(0, Math.min(10, (n / max) * 10));
  const color = ratingColor(score10);
  const stroke = Math.max(2.5, size * 0.09);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = score10 / 10;
  const label = score10 >= 10 ? "10" : score10.toFixed(1);
  const cls = ["rr", corner ? `rr-abs rr-${corner}` : "", className].join(" ").trim();
  return (
    <span className={cls} style={{ width: size, height: size, fontSize: size * (label.length > 2 ? 0.31 : 0.36), ...style }} role="img" aria-label={`Rating ${label} out of 10`}>
      <style>{css}</style>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={stroke} />
        <circle
          className="rr-ring"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap={frac >= 1 ? "butt" : "round"}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ "--rr-c": c }}
        />
      </svg>
      <span style={{ position: "relative" }}>{label}</span>
    </span>
  );
}

export default RatingRing;
