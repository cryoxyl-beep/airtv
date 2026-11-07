import React from 'react';

export interface NotFoundProps {
  homeHref?: string;
  onHome?: () => void;
  title?: string;
  description?: string;
  buttonText?: string;
}

export function NotFound(props?: NotFoundProps): React.JSX.Element;
export default NotFound;
