/**
 * Viewport-driven responsive breakpoint. Every screen in this app is a strict
 * narrow/wide binary (single column vs. centered capped column with a top
 * nav), so one cutoff is enough — no tablet-intermediate tier.
 *
 * `.web.ts` sibling adds a hydration guard (static web export pre-renders
 * with no real browser width) — see that file for why.
 */

import { useWindowDimensions } from 'react-native';

import { Breakpoints } from '@/constants/theme';

export interface Responsive {
  width: number;
  height: number;
  isWide: boolean;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return { width, height, isWide: width >= Breakpoints.desktop };
}
