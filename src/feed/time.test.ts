import assert from 'node:assert/strict';
import { test } from 'node:test';

import { relativeTime } from './time';

const NOW = new Date('2026-06-30T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test('relativeTime buckets minutes, hours, and days', () => {
  assert.equal(relativeTime(ago(0), NOW), 'just now');
  assert.equal(relativeTime(ago(30 * 1000), NOW), 'just now');
  assert.equal(relativeTime(ago(5 * 60 * 1000), NOW), '5m ago');
  assert.equal(relativeTime(ago(3 * 60 * 60 * 1000), NOW), '3h ago');
  assert.equal(relativeTime(ago(2 * 24 * 60 * 60 * 1000), NOW), '2d ago');
});

test('relativeTime clamps future timestamps to "just now"', () => {
  assert.equal(relativeTime(ago(-60 * 1000), NOW), 'just now');
});

test('relativeTime returns empty string for invalid input', () => {
  assert.equal(relativeTime('not-a-date', NOW), '');
});
