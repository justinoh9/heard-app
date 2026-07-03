/**
 * Theme selection. The chosen theme name persists to AsyncStorage
 * (device-wide — appearance is a device preference, not an account one) and
 * flows down through ThemePreferenceContext.
 *
 * `useTheme()` keeps its original signature — every screen already calls it
 * for a palette object — so the vinyl/cream switch touched no call sites.
 * `useThemeControls()` is the Settings picker's handle.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_THEME, Palettes, type Palette, type ThemeName } from '@/constants/theme';

const STORAGE_KEY = 'heard.theme';

interface ThemePreference {
  name: ThemeName;
  palette: Palette;
  setName: (name: ThemeName) => void;
}

export const ThemePreferenceContext = createContext<ThemePreference | null>(null);

export function useThemePreferenceState(): ThemePreference {
  const [name, setNameState] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled || !stored) return;
      if (stored in Palettes) setNameState(stored as ThemeName);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      name,
      palette: Palettes[name],
      setName: (next: ThemeName) => {
        setNameState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    }),
    [name],
  );
}

/** The active palette. Falls back to the default outside the provider. */
export function useTheme(): Palette {
  const ctx = useContext(ThemePreferenceContext);
  return ctx?.palette ?? Palettes[DEFAULT_THEME];
}

/** Theme name + setter, for the Settings appearance picker. */
export function useThemeControls(): { name: ThemeName; setName: (n: ThemeName) => void } {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemeControls must be used within ThemePreferenceContext');
  return { name: ctx.name, setName: ctx.setName };
}
