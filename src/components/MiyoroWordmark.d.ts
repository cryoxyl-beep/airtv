import React from 'react';

export interface MiyoroWordmarkProps {
  variant?: 'wordmark' | 'lockup';
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export function MiyoroWordmark(props?: MiyoroWordmarkProps): React.JSX.Element;
export default MiyoroWordmark;
