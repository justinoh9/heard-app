/**
 * The app's named themes. Every color a screen needs comes off one `Palette`
 * — no hardcoded accents in components — so switching themes is a single
 * context change (see src/hooks/use-theme.ts) and adding a theme is one new
 * entry here.
 *
 * Shipping palettes:
 *   vinyl (default) — near-black with red undertones + deep crimson accent
 *     and a brass secondary; the moody concert-photo look.
 *   cream           — warm paper + rust/olive; the HEYTEA-style light theme.
 */

import '@/global.css';

import { Platform } from 'react-native';

export interface Palette {
  /** Drives the navigation chrome + status bar (dark vs light treatment). */
  isDark: boolean;
  background: string;
  /** Cards, rows, input fields. */
  backgroundElement: string;
  /** Pressed/selected fills, skeletons, avatar circles. */
  backgroundSelected: string;
  text: string;
  textSecondary: string;
  /** The brand accent: score pills, primary buttons, active tab, links. */
  accent: string;
  /** Text/icons placed on an `accent` fill. */
  onAccent: string;
  /** Low-emphasis accent fill (badges, highlighted card washes). */
  accentSoft: string;
  /** Secondary accent for the daily-drop/live surfaces. */
  accentAlt: string;
  /** Text/icons placed on an `accentAlt` fill. */
  onAccentAlt: string;
  danger: string;
  /** Streak flames and caution accents. */
  warning: string;
}

export const Palettes = {
  vinyl: {
    isDark: true,
    background: '#140D0E',
    backgroundElement: '#211517',
    backgroundSelected: '#301D21',
    text: '#F4E3E3',
    textSecondary: '#A98F92',
    accent: '#C42847',
    onAccent: '#FFF1F1',
    accentSoft: '#3A1520',
    accentAlt: '#C9974C',
    onAccentAlt: '#140D0E',
    danger: '#E8604C',
    warning: '#EFA72A',
  },
  cream: {
    isDark: false,
    background: '#F6F1E7',
    backgroundElement: '#EDE5D4',
    backgroundSelected: '#E1D6BE',
    text: '#2B2620',
    textSecondary: '#7A705F',
    accent: '#C1512B',
    onAccent: '#FBF6EC',
    accentSoft: '#F0D9CC',
    accentAlt: '#6E7A4E',
    onAccentAlt: '#F6F1E7',
    danger: '#B23A2E',
    warning: '#9A6A10',
  },
} as const satisfies Record<string, Palette>;

export type ThemeName = keyof typeof Palettes;
export const DEFAULT_THEME: ThemeName = 'vinyl';

/** Keys of `Palette` that hold a color (excludes the `isDark` flag). */
export type ThemeColor = {
  [K in keyof Palette]: Palette[K] extends string ? K : never;
}[keyof Palette];

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Lives here (not in use-responsive.ts) because use-responsive.web.ts needs
 * it too, and importing it from './use-responsive' inside its own .web
 * sibling makes Metro's platform-extension resolution redirect that import
 * back to use-responsive.web.ts itself — infinite self-import.
 */
export const Breakpoints = { desktop: 768 } as const;
