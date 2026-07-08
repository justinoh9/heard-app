/**
 * Theme selection across three axes — `mode` (visual language) × `variant`
 * (palette) × `appearance` (light/dark/system) — persisted to AsyncStorage
 * (device-wide; appearance is a device preference, not an account one) and
 * flowed down through ThemePreferenceContext.
 *
 * `useTheme()` keeps its original signature — it still returns a `Palette`, so
 * every existing screen is untouched. `useTreatment()` is the new handle for
 * the structural (non-color) part of a mode; `useThemeControls()` drives the
 * Settings picker.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  DEFAULT_SELECTION,
  Modes,
  defaultVariant,
  type Appearance,
  type ModeName,
  type Palette,
  type ThemeSelection,
  type Treatment,
  type Variant,
} from '@/constants/theme';

// Bumped from 'heard.theme' — the stored shape changed from a bare name to a
// selection object, so the old key is intentionally ignored (falls back to the
// default selection, then re-persists under the new key on first change).
const STORAGE_KEY = 'jelli.theme';

interface ThemePreference {
  selection: ThemeSelection;
  palette: Palette;
  treatment: Treatment;
  setMode: (mode: ModeName) => void;
  setVariant: (variant: string) => void;
  setAppearance: (appearance: Appearance) => void;
}

export const ThemePreferenceContext = createContext<ThemePreference | null>(null);

/** Resolve a selection (+ the OS scheme) to a concrete palette + treatment. */
function resolve(selection: ThemeSelection, systemDark: boolean): { palette: Palette; treatment: Treatment } {
  const mode = Modes[selection.mode] ?? Modes[DEFAULT_SELECTION.mode];
  const variants = mode.variants as Record<string, Variant>;
  const variant = variants[selection.variant] ?? variants[Object.keys(variants)[0]];
  const dark = selection.appearance === 'system' ? systemDark : selection.appearance === 'dark';
  return { palette: dark ? variant.dark : variant.light, treatment: mode.treatment };
}

/** Coerce arbitrary stored JSON back into a valid selection (drops junk). */
function sanitize(raw: unknown): ThemeSelection | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<ThemeSelection>;
  if (!parsed.mode || !(parsed.mode in Modes)) return null;
  const mode = parsed.mode as ModeName;
  const variant = parsed.variant && parsed.variant in Modes[mode].variants ? parsed.variant : defaultVariant(mode);
  const appearance: Appearance =
    parsed.appearance === 'dark' || parsed.appearance === 'light' || parsed.appearance === 'system'
      ? parsed.appearance
      : DEFAULT_SELECTION.appearance;
  return { mode, variant, appearance };
}

export function useThemePreferenceState(): ThemePreference {
  const systemScheme = useColorScheme();
  const [selection, setSelection] = useState<ThemeSelection>(DEFAULT_SELECTION);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled || !stored) return;
      try {
        const next = sanitize(JSON.parse(stored));
        if (next) setSelection(next);
      } catch {
        // corrupt value — keep the default
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const systemDark = systemScheme === 'dark';

  return useMemo(() => {
    const persist = (next: ThemeSelection) => {
      setSelection(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    };
    const { palette, treatment } = resolve(selection, systemDark);
    return {
      selection,
      palette,
      treatment,
      setMode: (mode: ModeName) => persist({ mode, variant: defaultVariant(mode), appearance: selection.appearance }),
      setVariant: (variant: string) => persist({ ...selection, variant }),
      setAppearance: (appearance: Appearance) => persist({ ...selection, appearance }),
    };
  }, [selection, systemDark]);
}

/** The active palette. Falls back to the default outside the provider. */
export function useTheme(): Palette {
  const ctx = useContext(ThemePreferenceContext);
  return ctx?.palette ?? resolve(DEFAULT_SELECTION, false).palette;
}

/** The active mode's structural treatment (borders, shadow, wobble, grain…). */
export function useTreatment(): Treatment {
  const ctx = useContext(ThemePreferenceContext);
  return ctx?.treatment ?? resolve(DEFAULT_SELECTION, false).treatment;
}

/** Full selection + setters, for the Settings appearance picker. */
export function useThemeControls(): ThemePreference {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemeControls must be used within ThemePreferenceContext');
  return ctx;
}
