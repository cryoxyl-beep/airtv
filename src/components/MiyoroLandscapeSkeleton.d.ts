import React from 'react';

export function LandscapeSkeleton(props?: { text?: boolean; style?: React.CSSProperties }): React.JSX.Element;
export function LandscapeSkeletonRow(props?: { count?: number; cardWidth?: number | string; gap?: number | string; text?: boolean; style?: React.CSSProperties }): React.JSX.Element;
export function LandscapeSkeletonGrid(props?: { count?: number; minWidth?: number | string; gap?: number | string; text?: boolean; style?: React.CSSProperties }): React.JSX.Element;
export function LandscapeSkeletonSection(props?: { children?: React.ReactNode; style?: React.CSSProperties }): React.JSX.Element;
export default LandscapeSkeleton;
