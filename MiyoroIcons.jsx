/**
 * Miyoro icon set: custom 24x24 line icons with one consistent look
 * (rounded caps and joins, same stroke weight, same corner radius).
 *
 * - Colour is currentColor, so the icon follows your text colour.
 * - `active` gives a soft filled look, meant for the selected nav item.
 *
 *   <HomeIcon size={22} />
 *   <SearchIcon active />
 */
function Icon({ size = 24, strokeWidth = 1.5, active = false, className, style, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? strokeWidth + 0.25 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </svg>
  );
}

const tint = (active) => (active ? { fill: "currentColor", fillOpacity: 0.2 } : {});

export function HomeIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <path
        d="M4 10.4 L12 3.6 L20 10.4 V18 a2.2 2.2 0 0 1 -2.2 2.2 H6.2 A2.2 2.2 0 0 1 4 18 Z"
        {...tint(active)}
      />
      <path d="M9.8 20.2 V15.2 a2.2 2.2 0 0 1 4.4 0 V20.2" />
    </Icon>
  );
}

export function SearchIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <circle cx="10.6" cy="10.6" r="6.6" {...tint(active)} />
      <path d="M15.6 15.6 L20.2 20.2" />
    </Icon>
  );
}

// TV / Series: monitor with a stand line.
export function TvIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <rect x="3" y="4.4" width="18" height="12.6" rx="1.4" {...tint(active)} />
      <path d="M8.4 20.4 H15.6" />
    </Icon>
  );
}
export const SeriesIcon = TvIcon;

// Anime: open ring with a crescent moon inside.
export function AnimeIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <path d="M20.2 7.2 A9.2 9.2 0 1 0 21 13.6" />
      <path d="M16.3 8.4 A5.5 5.5 0 1 0 16.3 15.6 A3.7 3.7 0 0 1 16.3 8.4 Z" {...tint(active)} />
    </Icon>
  );
}

// Movies: popcorn bucket.
export function MoviesIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <path
        d="M5.4 10.2 L6.8 20.4 H17.2 L18.6 10.2 Z"
        {...tint(active)}
      />
      <path d="M9.6 10.2 L10 20.4 M14.4 10.2 L14 20.4" />
      <path d="M5.2 10.2 A2.1 2.1 0 0 1 6 6.6 A2.5 2.5 0 0 1 10.2 5.2 A2.5 2.5 0 0 1 13.8 5.2 A2.5 2.5 0 0 1 18 6.6 A2.1 2.1 0 0 1 18.8 10.2" />
    </Icon>
  );
}

// Sports: ball with diagonal stripes.
export function SportsIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <circle cx="12" cy="12" r="9" {...tint(active)} />
      <path d="M3.3 14.3 L14.3 3.3 M5.6 18.4 L18.4 5.6 M9.7 20.7 L20.7 9.7" />
    </Icon>
  );
}

// Sparks: lightning bolt.
export function SparksIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <path d="M13.2 2.8 L4.8 13.4 H11.2 L10.6 21.2 L19.2 10.4 H12.6 Z" {...tint(active)} />
    </Icon>
  );
}

// Categories: tall panel + dot + square.
export function CategoriesIcon({ active, ...props }) {
  return (
    <Icon active={active} {...props}>
      <rect x="4.2" y="3.4" width="5.2" height="17.2" rx="1.3" {...tint(active)} />
      <circle cx="16.8" cy="6.4" r="2.5" {...tint(active)} />
      <rect x="14.2" y="12" width="5.2" height="5.2" rx="1" {...tint(active)} />
    </Icon>
  );
}

export const miyoroIcons = {
  home: HomeIcon,
  search: SearchIcon,
  tv: TvIcon,
  series: TvIcon,
  anime: AnimeIcon,
  movies: MoviesIcon,
  sports: SportsIcon,
  sparks: SparksIcon,
  categories: CategoriesIcon,
};
