import React from 'react';

export interface MiyoroSpinnerProps {
  size?: number;
  color?: string;
  label?: string;
}

export function MiyoroSpinner(props?: MiyoroSpinnerProps): React.JSX.Element;

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children?: React.ReactNode;
  disabled?: boolean;
  spinnerSize?: number;
  style?: React.CSSProperties;
}

export function LoadingButton(props: LoadingButtonProps): React.JSX.Element;
export default MiyoroSpinner;
