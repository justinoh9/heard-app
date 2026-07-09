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

/** Font role keys; resolved to concrete families by `DisplayFonts`. */
export type FontKey = 'serif' | 'rounded' | 'mono' | 'hand' | 'sans';

/**
 * A visual mode's *structural* treatment — the non-color part of its identity.
 * Colors live on `Palette`; this holds the texture (borders, shadows, grain)
 * and interaction feel (wobble) that make Scribble ≠ Jelly ≠ PB&J ≠ Riso.
 * Components read it via `useTreatment()` and interpret each token themselves,
 * so a mode is fully described by one `Treatment` + its palette variants.
 */
export interface Treatment {
  /** Card/border stroke width. Scribble is heavy ink; Jelly is a hairline. */
  borderWidth: number;
  borderStyle: 'solid' | 'dashed';
  /** Corner radius for cards/controls. Riso is 0 (hard print), Jelly is round. */
  radius: number;
  /** Elevation language: offset sticker, glossy gel, hard print block, or flat. */
  shadow: 'sticker' | 'gel' | 'hard' | 'none';
  /** Score emphasis under the number. */
  underline: 'wavy' | 'straight' | 'none';
  /** Squish-on-press micro-interaction (Jelly's signature). */
  wobble: boolean;
  /** Riso grain overlay on surfaces. */
  grain: boolean;
  /** Display-font hint (wordmark, titles); the loader maps this to a family. */
  font: FontKey;
  /** Body-font hint (labels + paragraphs). Lets Scribble stay hand at heading
   *  size but clean at body size, so the app isn't uniformly cursive. */
  bodyFont: FontKey;
  /** Draw the card border as a wobbly hand-drawn path instead of a crisp
   *  rectangle (Scribble's fluid, sketched look). */
  sketch: boolean;
}

/** A named palette that ships light + dark counterparts for the global toggle. */
export interface Variant {
  label: string;
  light: Palette;
  dark: Palette;
}

export interface Mode {
  label: string;
  treatment: Treatment;
  /** One or more color palettes; the first is the mode's default. */
  variants: Record<string, Variant>;
}

/**
 * The theme catalog. Selection is three axes: `mode` (visual language) ×
 * `variant` (palette) × `appearance` (light/dark/system). Adding a palette is
 * one `Variant` entry; adding a whole look is one `Mode`.
 */
export const Modes = {
  scribble: {
    label: 'Scribble',
    // Fluid + minimalist: a hand-drawn wobbly border (sketch) carries the card,
    // so no heavy sticker shadow. Hand display font, clean sans body.
    treatment: { borderWidth: 2, borderStyle: 'solid', radius: 20, shadow: 'none', underline: 'wavy', wobble: false, grain: false, font: 'hand', bodyFont: 'sans', sketch: true },
    variants: {
      ink: {
        label: 'Charcoal',
        light: { isDark: false, background: '#FAF6EC', backgroundElement: '#FFFFFF', backgroundSelected: '#EFE7D6', text: '#2B2724', textSecondary: '#8C8377', accent: '#4A443B', onAccent: '#FAF6EC', accentSoft: '#E7E0D2', accentAlt: '#B0752F', onAccentAlt: '#FFFFFF', danger: '#E0503C', warning: '#E8A21E' },
        dark: { isDark: true, background: '#17140F', backgroundElement: '#211D17', backgroundSelected: '#2E281F', text: '#F1EADB', textSecondary: '#ADA089', accent: '#E7D9BE', onAccent: '#1A1610', accentSoft: '#2E281F', accentAlt: '#D9A85A', onAccentAlt: '#17140F', danger: '#F0604A', warning: '#F2B33A' },
      },
      tangerine: {
        label: 'Tangerine',
        light: { isDark: false, background: '#FAF6EC', backgroundElement: '#FFFFFF', backgroundSelected: '#EFE7D6', text: '#2B2724', textSecondary: '#8C8377', accent: '#EE6B3B', onAccent: '#FFF7F1', accentSoft: '#FBE1D2', accentAlt: '#3FA789', onAccentAlt: '#FFFFFF', danger: '#E0503C', warning: '#E8A21E' },
        dark: { isDark: true, background: '#17140F', backgroundElement: '#211D17', backgroundSelected: '#2E281F', text: '#F1EADB', textSecondary: '#ADA089', accent: '#FF8C54', onAccent: '#2A1408', accentSoft: '#3A2A1C', accentAlt: '#57C0A0', onAccentAlt: '#141009', danger: '#F0604A', warning: '#F2B33A' },
      },
      berry: {
        label: 'Berry',
        light: { isDark: false, background: '#FAF6EC', backgroundElement: '#FFFFFF', backgroundSelected: '#EFE7D6', text: '#2B2724', textSecondary: '#8C8377', accent: '#D8476B', onAccent: '#FFF5F7', accentSoft: '#FAD9E2', accentAlt: '#E0973C', onAccentAlt: '#FFFFFF', danger: '#E0503C', warning: '#E8A21E' },
        dark: { isDark: true, background: '#17140F', backgroundElement: '#211D17', backgroundSelected: '#2E281F', text: '#F1EADB', textSecondary: '#ADA089', accent: '#FF6E92', onAccent: '#2A0E16', accentSoft: '#3A1E28', accentAlt: '#E6A94E', onAccentAlt: '#17140F', danger: '#F0604A', warning: '#F2B33A' },
      },
      sky: {
        label: 'Sky',
        light: { isDark: false, background: '#FAF6EC', backgroundElement: '#FFFFFF', backgroundSelected: '#EFE7D6', text: '#2B2724', textSecondary: '#8C8377', accent: '#3E82C4', onAccent: '#F3F8FE', accentSoft: '#D6E7F5', accentAlt: '#E0973C', onAccentAlt: '#FFFFFF', danger: '#E0503C', warning: '#E8A21E' },
        dark: { isDark: true, background: '#17140F', backgroundElement: '#211D17', backgroundSelected: '#2E281F', text: '#F1EADB', textSecondary: '#ADA089', accent: '#6FA9E0', onAccent: '#0A1A2A', accentSoft: '#1E2A3A', accentAlt: '#E6A94E', onAccentAlt: '#17140F', danger: '#F0604A', warning: '#F2B33A' },
      },
      matcha: {
        label: 'Matcha',
        light: { isDark: false, background: '#FAF6EC', backgroundElement: '#FFFFFF', backgroundSelected: '#EFE7D6', text: '#2B2724', textSecondary: '#8C8377', accent: '#5B9E5B', onAccent: '#F4FAF3', accentSoft: '#DCEBD6', accentAlt: '#D8843C', onAccentAlt: '#FFFFFF', danger: '#E0503C', warning: '#E8A21E' },
        dark: { isDark: true, background: '#17140F', backgroundElement: '#211D17', backgroundSelected: '#2E281F', text: '#F1EADB', textSecondary: '#ADA089', accent: '#82C182', onAccent: '#0E1E0E', accentSoft: '#1E2E1E', accentAlt: '#E0973C', onAccentAlt: '#17140F', danger: '#F0604A', warning: '#F2B33A' },
      },
    },
  },
  jelly: {
    label: 'Jelly',
    treatment: { borderWidth: 1, borderStyle: 'solid', radius: 22, shadow: 'gel', underline: 'none', wobble: true, grain: false, font: 'rounded', bodyFont: 'rounded', sketch: false },
    variants: {
      blueberry: {
        label: 'Blueberry Jam',
        light: { isDark: false, background: '#EEF2FF', backgroundElement: '#FFFFFF', backgroundSelected: '#DCE4FF', text: '#141A3A', textSecondary: '#5A6392', accent: '#3B6BE0', onAccent: '#FFFFFF', accentSoft: '#D6E0FF', accentAlt: '#7C4DFF', onAccentAlt: '#FFFFFF', danger: '#D2405A', warning: '#E0942A' },
        dark: { isDark: true, background: '#0C1030', backgroundElement: '#161C46', backgroundSelected: '#212A66', text: '#EAF0FF', textSecondary: '#9AA6E0', accent: '#5B8CFF', onAccent: '#08102E', accentSoft: '#20285E', accentAlt: '#B98CFF', onAccentAlt: '#0C1030', danger: '#FF6E8A', warning: '#FFC24D' },
      },
      grape: {
        label: 'Grape Jelli',
        light: { isDark: false, background: '#F6ECFF', backgroundElement: '#FFFFFF', backgroundSelected: '#EAD6FF', text: '#2A123A', textSecondary: '#6E5285', accent: '#9D4EDD', onAccent: '#FFFFFF', accentSoft: '#EBD6FA', accentAlt: '#FF6EC4', onAccentAlt: '#3A0E2E', danger: '#D2405A', warning: '#E0942A' },
        dark: { isDark: true, background: '#160E22', backgroundElement: '#241634', backgroundSelected: '#33204A', text: '#F4ECFF', textSecondary: '#C0A6DE', accent: '#B06BFF', onAccent: '#1E0A2E', accentSoft: '#2E1B44', accentAlt: '#FF8ED0', onAccentAlt: '#160E22', danger: '#FF6E8A', warning: '#FFC24D' },
      },
    },
  },
  pbj: {
    label: 'PB & J',
    treatment: { borderWidth: 2, borderStyle: 'dashed', radius: 16, shadow: 'none', underline: 'straight', wobble: false, grain: false, font: 'serif', bodyFont: 'serif', sketch: false },
    variants: {
      classic: {
        label: 'Peanut + grape',
        light: { isDark: false, background: '#F3E4C7', backgroundElement: '#FBF3E1', backgroundSelected: '#EBD9B4', text: '#3A2410', textSecondary: '#8A6A3E', accent: '#7A3E86', onAccent: '#FBF3E1', accentSoft: '#E7D3EC', accentAlt: '#D79A3E', onAccentAlt: '#3A2410', danger: '#B23A2E', warning: '#C2410C' },
        dark: { isDark: true, background: '#201406', backgroundElement: '#2E1E0C', backgroundSelected: '#402B12', text: '#F4E6CF', textSecondary: '#C0A277', accent: '#B673C2', onAccent: '#1E0A22', accentSoft: '#3A2440', accentAlt: '#E0A94E', onAccentAlt: '#201406', danger: '#E8604C', warning: '#EFA72A' },
      },
    },
  },
  riso: {
    label: 'Riso zine',
    treatment: { borderWidth: 2, borderStyle: 'solid', radius: 0, shadow: 'hard', underline: 'none', wobble: false, grain: true, font: 'mono', bodyFont: 'mono', sketch: false },
    variants: {
      inkAndFlame: {
        label: 'Ink + flame',
        light: { isDark: false, background: '#EDE9E1', backgroundElement: '#F7F4EC', backgroundSelected: '#DED8CB', text: '#1A1A1A', textSecondary: '#555555', accent: '#0E4FB0', onAccent: '#FFFFFF', accentSoft: '#CFDCF2', accentAlt: '#FF4D3D', onAccentAlt: '#FFFFFF', danger: '#FF4D3D', warning: '#E0942A' },
        dark: { isDark: true, background: '#121212', backgroundElement: '#1E1E1E', backgroundSelected: '#2A2A2A', text: '#F2EFE7', textSecondary: '#A6A6A6', accent: '#5B8CE8', onAccent: '#0A1428', accentSoft: '#1C2740', accentAlt: '#FF6E5E', onAccentAlt: '#121212', danger: '#FF6E5E', warning: '#FFC24D' },
      },
    },
  },
  classic: {
    label: 'Classic vinyl',
    treatment: { borderWidth: 1, borderStyle: 'solid', radius: 12, shadow: 'none', underline: 'none', wobble: false, grain: false, font: 'serif', bodyFont: 'sans', sketch: false },
    variants: {
      vinyl: {
        label: 'Vinyl red',
        light: { isDark: false, background: '#F6F1E7', backgroundElement: '#EDE5D4', backgroundSelected: '#E1D6BE', text: '#2B2620', textSecondary: '#7A705F', accent: '#C1512B', onAccent: '#FBF6EC', accentSoft: '#F0D9CC', accentAlt: '#6E7A4E', onAccentAlt: '#F6F1E7', danger: '#B23A2E', warning: '#9A6A10' },
        dark: { isDark: true, background: '#140D0E', backgroundElement: '#211517', backgroundSelected: '#301D21', text: '#F4E3E3', textSecondary: '#A98F92', accent: '#C42847', onAccent: '#FFF1F1', accentSoft: '#3A1520', accentAlt: '#C9974C', onAccentAlt: '#140D0E', danger: '#E8604C', warning: '#EFA72A' },
      },
    },
  },
} as const satisfies Record<string, Mode>;

export type ModeName = keyof typeof Modes;
export type Appearance = 'light' | 'dark' | 'system';

/** Full theme selection across the three axes. */
export interface ThemeSelection {
  mode: ModeName;
  /** A variant key within `Modes[mode].variants`. */
  variant: string;
  appearance: Appearance;
}

export const DEFAULT_SELECTION: ThemeSelection = {
  mode: 'scribble',
  variant: 'ink',
  appearance: 'light',
};

/** The first (default) variant key for a mode. */
export function defaultVariant(mode: ModeName): string {
  return Object.keys(Modes[mode].variants)[0];
}

/** Keys of `Palette` that hold a color (excludes the `isDark` flag). */
export type ThemeColor = {
  [K in keyof Palette]: Palette[K] extends string ? K : never;
}[keyof Palette];

/**
 * The editorial display face (wordmark, titles, subtitles) — Fraunces, loaded
 * in the root layout via @expo-google-fonts/fraunces. Body text stays on the
 * system sans for legibility; the serif is the brand voice.
 */
export const DisplayFont = 'Fraunces_600SemiBold';

/**
 * Font families per role key — a mode's `treatment.font` / `bodyFont` pick from
 * these. Loaded families (Fraunces, Baloo 2, Patrick Hand) must stay in sync
 * with the useFonts() call in the root layout; `mono`/`sans` are system stacks
 * that need no file. `hand` is Patrick Hand (a legible hand *print*, not a
 * flowing cursive) so Scribble reads as sketched, not scripty.
 */
export const DisplayFonts: Record<FontKey, string> = {
  serif: 'Fraunces_600SemiBold',
  rounded: 'Baloo2_600SemiBold',
  mono: Platform.select({ ios: 'Courier New', default: 'monospace' }) ?? 'monospace',
  hand: 'PatrickHand_400Regular',
  sans: Platform.select({ web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', ios: 'System', default: 'sans-serif' }) ?? 'sans-serif',
};

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
