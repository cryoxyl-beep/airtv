import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  active?: boolean;
}

export function HomeIcon(props: IconProps): React.JSX.Element;
export function SearchIcon(props: IconProps): React.JSX.Element;
export function TvIcon(props: IconProps): React.JSX.Element;
export function SeriesIcon(props: IconProps): React.JSX.Element;
export function AnimeIcon(props: IconProps): React.JSX.Element;
export function MoviesIcon(props: IconProps): React.JSX.Element;
export function SportsIcon(props: IconProps): React.JSX.Element;
export function SparksIcon(props: IconProps): React.JSX.Element;
export function CategoriesIcon(props: IconProps): React.JSX.Element;

export const miyoroIcons: {
  home: typeof HomeIcon;
  search: typeof SearchIcon;
  tv: typeof TvIcon;
  series: typeof TvIcon;
  anime: typeof AnimeIcon;
  movies: typeof MoviesIcon;
  sports: typeof SportsIcon;
  sparks: typeof SparksIcon;
  categories: typeof CategoriesIcon;
};
