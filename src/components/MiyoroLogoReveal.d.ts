import React from 'react';

export interface LogoRevealProps {
  size?: number;
  color?: string;
  onDone?: () => void;
  key?: React.Key;
}

export function LogoReveal(props: LogoRevealProps): React.JSX.Element;
export default LogoReveal;
