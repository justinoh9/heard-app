import { useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import {
  MAX_SCORE,
  MIN_SCORE,
  SCORE_STEP,
  parseScoreInput,
  ratioFromScore,
  scoreColor,
  scoreFromRatio,
  snapScore,
} from '@/ranking/score';

const THUMB = 28;
const TRACK_HEIGHT = 8;

/**
 * The hero rating control: a draggable, color-coded 0–10 slider with tap-to-type
 * precision entry and fine +/- nudge buttons. Replaces the old stepper so a user
 * can land any of 0.0–10.0 in one gesture instead of dozens of taps.
 */
export function ScoreInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const theme = useTheme();
  const haptics = useHaptics();

  const [trackWidth, setTrackWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const trackRef = useRef<View>(null);
  // Absolute on-screen geometry of the track, for mapping touch pageX → score.
  const geom = useRef({ x: 0, width: 1 });
  // Freshest callback/value so the once-created PanResponder never goes stale.
  const apply = useRef((_pageX: number) => {});
  apply.current = (pageX: number) => {
    const next = scoreFromRatio((pageX - geom.current.x) / geom.current.width);
    if (next !== value) {
      haptics.selection();
      onChange(next);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const pageX = e.nativeEvent.pageX;
        trackRef.current?.measureInWindow((x, _y, width) => {
          geom.current = { x, width: width || geom.current.width };
          apply.current(pageX);
        });
      },
      onPanResponderMove: (e) => apply.current(e.nativeEvent.pageX),
    }),
  ).current;

  function onTrackLayout(e: LayoutChangeEvent) {
    const width = e.nativeEvent.layout.width;
    setTrackWidth(width);
    trackRef.current?.measureInWindow((x, _y, w) => {
      geom.current = { x, width: w || width || 1 };
    });
  }

  function nudge(delta: number) {
    haptics.selection();
    onChange(snapScore(value + delta));
  }

  function startEditing() {
    setDraft(value.toFixed(1));
    setEditing(true);
  }

  function commitEditing() {
    const parsed = parseScoreInput(draft);
    if (parsed !== null && parsed !== value) {
      haptics.selection();
      onChange(parsed);
    }
    setEditing(false);
  }

  const color = scoreColor(value);
  const ratio = ratioFromScore(value);
  const fillWidth = ratio * trackWidth;
  const thumbLeft = Math.max(0, Math.min(trackWidth - THUMB, ratio * trackWidth - THUMB / 2));

  return (
    <View style={styles.container}>
      {editing ? (
        <TextInput
          testID="score-input-field"
          value={draft}
          onChangeText={setDraft}
          onBlur={commitEditing}
          onSubmitEditing={commitEditing}
          keyboardType="decimal-pad"
          autoFocus
          selectTextOnFocus
          maxLength={4}
          style={[styles.bigScore, styles.bigScoreInput, { color }]}
        />
      ) : (
        <Pressable
          testID="score-input-number"
          onPress={startEditing}
          accessibilityLabel={`Score ${value.toFixed(1)} of 10. Tap to type a value.`}>
          <ThemedText style={[styles.bigScore, { color }]}>{value.toFixed(1)}</ThemedText>
        </Pressable>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Drag the slider, or tap the number to type it
      </ThemedText>

      <View style={styles.sliderRow}>
        <View
          ref={trackRef}
          onLayout={onTrackLayout}
          style={styles.track}
          // Spread on the touch surface so a grab anywhere on the track works.
          {...pan.panHandlers}>
          <View style={[styles.trackBg, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.trackFill, { width: fillWidth, backgroundColor: color }]} />
          <View
            testID="score-input-thumb"
            style={[styles.thumb, { left: thumbLeft, backgroundColor: color, borderColor: theme.background }]}
          />
        </View>
      </View>

      <View style={styles.scaleRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {MIN_SCORE}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {MAX_SCORE}
        </ThemedText>
      </View>

      <View style={styles.nudgeRow}>
        {[-1, -SCORE_STEP, SCORE_STEP, 1].map((d) => (
          <Pressable
            key={d}
            testID={`score-nudge-${d}`}
            onPress={() => nudge(d)}
            style={({ pressed }) => [
              styles.nudge,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
            ]}>
            <ThemedText type="smallBold">{d > 0 ? `+${d}` : `${d}`}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', alignSelf: 'stretch', gap: Spacing.two },
  bigScore: { fontSize: 72, fontWeight: '700', lineHeight: 80, textAlign: 'center' },
  bigScoreInput: { minWidth: 180, padding: 0 },
  hint: { textAlign: 'center' },
  sliderRow: { alignSelf: 'stretch', paddingHorizontal: Spacing.two },
  track: { height: THUMB, justifyContent: 'center' },
  trackBg: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  trackFill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.18)',
    elevation: 3,
  },
  scaleRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  nudgeRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  nudge: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    minWidth: 56,
    alignItems: 'center',
  },
});
