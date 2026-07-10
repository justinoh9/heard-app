/**
 * Toaster notification — a toast that pops UP from the bottom like a slice out
 * of a toaster (spring overshoot + a little settle-wiggle), plays a bright
 * "Ding!", holds, then drops back down. One at a time; a new toast replaces the
 * current one.
 *
 * Usage: `const toast = useToast(); toast('Logged', '🔥');`
 *
 * The "Ding!" is synthesized with the Web Audio API so it needs no bundled asset
 * and no dependency. It only sounds on web (the local check target); native is a
 * silent no-op for now — a real device chime is a follow-up (expo-audio).
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme, useTreatment } from '@/hooks/use-theme';

type ToastMsg = { id: number; text: string; emoji?: string };

/** Show a toast. `emoji` is the little icon that rides on the left (🍞 default). */
type ShowToast = (text: string, emoji?: string) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const idRef = useRef(0);

  const show = useCallback<ShowToast>((text, emoji) => {
    idRef.current += 1;
    setToast({ id: idRef.current, text, emoji });
    playDing();
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <ToastCard
          // Re-key per message so the card remounts and replays its pop enter.
          key={toast.id}
          toast={toast}
          onDone={() => setToast((cur) => (cur?.id === toast.id ? null : cur))}
        />
      )}
    </ToastContext.Provider>
  );
}

const HIDDEN_Y = 160; // parked below the screen edge
const HOLD_MS = 2400;

function ToastCard({ toast, onDone }: { toast: ToastMsg; onDone: () => void }) {
  const theme = useTheme();
  const treatment = useTreatment();

  const y = useSharedValue(HIDDEN_Y);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Pop up with overshoot (the "eject"), then a quick tilt-and-settle wiggle.
    opacity.value = withTiming(1, { duration: 140 });
    y.value = withSpring(0, { damping: 9, stiffness: 170, mass: 0.7 });
    rot.value = withSequence(
      withTiming(-4, { duration: 90 }),
      withSpring(0, { damping: 5, stiffness: 220 }),
    );

    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 260 });
      y.value = withTiming(HIDDEN_Y, { duration: 320 }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, HOLD_MS);
    return () => clearTimeout(t);
    // Runs once on mount; the card is re-keyed per message so this always fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }],
  }));

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View
        style={[
          styles.card,
          animated,
          {
            backgroundColor: theme.accent,
            borderRadius: treatment.radius,
            // Scribble/other outlined modes get a matching ink border.
            borderWidth: treatment.borderWidth > 0 ? 2 : 0,
            borderColor: theme.onAccent,
          },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.onAccent, fontSize: 18 }}>
          {toast.emoji ?? '🍞'}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          {toast.text}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

/** A two-tone bell "ding" via Web Audio — no asset, no dependency. Web-only. */
function playDing() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.setValueAtTime(1320, now + 0.08); // jump up → "ding!"
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
    osc.onended = () => ctx.close();
  } catch {
    // Autoplay policy may block audio until a user gesture — silently skip.
  }
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    // Clear of the bottom tab bar / home indicator.
    paddingBottom: 96,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    maxWidth: '86%',
    boxShadow: '0px 6px 16px rgba(0,0,0,0.18)',
    elevation: 6,
  },
});
