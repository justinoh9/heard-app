/**
 * Tiny relative-time formatter for feed timestamps ("just now", "3h ago").
 * Pure and dependency-free so it runs under the `tsx` node test runner.
 */

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const min = Math.floor(Math.max(0, now - then) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
