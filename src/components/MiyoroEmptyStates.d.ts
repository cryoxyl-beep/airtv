import React from 'react';

export type EmptyStateVariant = 'search' | 'list' | 'history' | 'offline' | 'error';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}

export function EmptyState(props?: EmptyStateProps): React.JSX.Element;
export default EmptyState;
