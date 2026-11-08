import React from 'react';

export function ratingColor(score10: number): string;

export interface RatingRingProps {
  value?: number | string | null;
  max?: number;
  size?: number;
  corner?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
  style?: React.CSSProperties;
}

export function RatingRing(props: RatingRingProps): React.JSX.Element | null;
export default RatingRing;
