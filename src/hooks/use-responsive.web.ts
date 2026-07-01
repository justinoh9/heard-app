/**
 * To support static rendering, this value needs to be re-calculated on the
 * client side for web — same reasoning as `use-color-scheme.web.ts`. Defaults
 * to the narrow/mobile layout until hydrated, matching that hook's bias
 * (defaults to 'light') and native's steady-state reality (phones are narrow).
 *
 * Deliberately does not import anything from './use-responsive' (not even a
 * type) — any import of that specifier from web code resolves to this very
 * file under Metro's platform-extension resolution, so even a type-only
 * cross-import produces a require cycle. `Breakpoints` lives in
 * `@/constants/theme` instead, and the `Responsive` shape is duplicated here.
 */

import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { Breakpoints } from '@/constants/theme';

export interface Responsive {
  width: number;
  height: number;
  isWide: boolean;
}

export function useResponsive(): Responsive {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const { width, height } = useWindowDimensions();

  if (!hasHydrated) {
    return { width: 0, height: 0, isWide: false };
  }

  return { width, height, isWide: width >= Breakpoints.desktop };
}
