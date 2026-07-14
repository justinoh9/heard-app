/**
 * Preview playback (ROADMAP Phase 2 / F2). One shared audio player for the
 * whole app so only a single 30-second iTunes preview plays at a time —
 * tapping a new clip replaces the current one. Mounted once in the root
 * layout; `PreviewButton` (components/preview-button.tsx) is the play/pause
 * affordance on search rows, tracklists, and item pages.
 *
 * expo-audio works on web (HTMLAudioElement) and native, so this needs no
 * platform branching.
 */

import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface PreviewApi {
  /** The preview URL currently loaded, or null when nothing is playing. */
  activeUrl: string | null;
  /** True while the active clip is actually sounding (false when paused). */
  playing: boolean;
  /** Play `url` (replacing any other), or pause/resume if it's already active. */
  toggle: (url: string) => void;
}

const PreviewContext = createContext<PreviewApi | null>(null);

/**
 * Inert stand-in for static rendering. expo-audio's web player constructs an
 * HTMLAudioElement during render, and Node (expo export) has no `Audio`
 * global — calling usePreviewState there throws and blanks the whole
 * pre-rendered page (every route shares this provider). The export gets this
 * no-op instead; the browser mounts the real player on hydration.
 */
export const STATIC_PREVIEW: PreviewApi = {
  activeUrl: null,
  playing: false,
  toggle: () => {},
};

export function usePreviewState(): PreviewApi {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  // Previews are short and optional — let them sound even with the ringer off.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // When a clip finishes on its own, reset so the button flips back to play.
  useEffect(() => {
    if (status.didJustFinish) setActiveUrl(null);
  }, [status.didJustFinish]);

  return useMemo<PreviewApi>(
    () => ({
      activeUrl,
      playing: status.playing,
      toggle: (url: string) => {
        if (activeUrl === url) {
          if (status.playing) player.pause();
          else player.play();
          return;
        }
        player.replace({ uri: url });
        player.seekTo(0);
        player.play();
        setActiveUrl(url);
      },
    }),
    [activeUrl, status.playing, player],
  );
}

export function usePreview(): PreviewApi {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error('usePreview must be used within PreviewContext.Provider');
  return ctx;
}

export { PreviewContext };
