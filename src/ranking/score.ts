/**
 * Pure helpers for the 0–10 rating scale. Kept free of React/React Native so
 * the slider math and typed-entry parsing can be unit-tested (score.test.ts)
 * the same way the ranking engine is. The UI lives in
 * `src/components/score-input.tsx`.
 */

export const MIN_SCORE = 0;
export const MAX_SCORE = 10;
export const SCORE_STEP = 0.1;

/** Clamp to [0, 10] and round to the nearest 0.1 (the rating granularity). */
export function snapScore(value: number): number {
  const clamped = Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));
  // Round on integers (×10) to avoid binary-float drift like 8.500000001.
  return Math.round(clamped * 10) / 10;
}

/** Map a 0..1 track position to a snapped score. */
export function scoreFromRatio(ratio: number): number {
  const r = Math.min(1, Math.max(0, ratio));
  return snapScore(MIN_SCORE + r * (MAX_SCORE - MIN_SCORE));
}

/** Map a score to its 0..1 position on the track. */
export function ratioFromScore(score: number): number {
  return (snapScore(score) - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
}

/**
 * Parse free-typed text (numeric keypad) into a valid score, or null when it
 * isn't a number. A partial entry like "" or "." parses to null so the caller
 * can keep the previous value instead of snapping to 0.
 */
export function parseScoreInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed === '.') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return snapScore(n);
}

type ColorStop = { at: number; rgb: [number, number, number] };

// Red (low) → amber (mid) → green (good), matching the app's #1D9E75 accent.
const COLOR_STOPS: ColorStop[] = [
  { at: 0, rgb: [226, 75, 74] }, // #E24B4A
  { at: 5, rgb: [239, 159, 39] }, // #EF9F27
  { at: 7.5, rgb: [29, 158, 117] }, // #1D9E75
  { at: 10, rgb: [29, 158, 117] }, // #1D9E75
];

/** Interpolated hex color for a score, used to tint the slider and big number. */
export function scoreColor(score: number): string {
  const s = Math.min(MAX_SCORE, Math.max(MIN_SCORE, score));
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (s >= COLOR_STOPS[i].at && s <= COLOR_STOPS[i + 1].at) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at || 1;
  const t = (s - lo.at) / span;
  const channel = (i: number) => Math.round(lo.rgb[i] + (hi.rgb[i] - lo.rgb[i]) * t);
  return `#${[channel(0), channel(1), channel(2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
