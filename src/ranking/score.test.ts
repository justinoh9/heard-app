import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_SCORE,
  MIN_SCORE,
  parseScoreInput,
  ratioFromScore,
  scoreColor,
  scoreFromRatio,
  snapScore,
} from './score';

test('snapScore rounds to the nearest 0.1', () => {
  assert.equal(snapScore(8.54), 8.5);
  assert.equal(snapScore(8.55), 8.6);
  assert.equal(snapScore(7), 7);
});

test('snapScore clamps to [0, 10]', () => {
  assert.equal(snapScore(-3), MIN_SCORE);
  assert.equal(snapScore(42), MAX_SCORE);
});

test('snapScore avoids float drift', () => {
  // A naive round(x/0.1)*0.1 would yield 8.500000000000001 here.
  assert.equal(snapScore(8.5), 8.5);
  assert.equal(snapScore(0.3), 0.3);
});

test('scoreFromRatio maps the track ends and middle', () => {
  assert.equal(scoreFromRatio(0), 0);
  assert.equal(scoreFromRatio(1), 10);
  assert.equal(scoreFromRatio(0.5), 5);
});

test('scoreFromRatio clamps out-of-range ratios', () => {
  assert.equal(scoreFromRatio(-0.5), 0);
  assert.equal(scoreFromRatio(1.5), 10);
});

test('ratioFromScore is the inverse of scoreFromRatio at the ends', () => {
  assert.equal(ratioFromScore(0), 0);
  assert.equal(ratioFromScore(10), 1);
  assert.equal(ratioFromScore(2.5), 0.25);
});

test('parseScoreInput parses, clamps, and snaps', () => {
  assert.equal(parseScoreInput('8.5'), 8.5);
  assert.equal(parseScoreInput('  9.27 '), 9.3);
  assert.equal(parseScoreInput('13'), 10);
  assert.equal(parseScoreInput('-2'), 0);
});

test('parseScoreInput returns null for non-numbers and partial entries', () => {
  assert.equal(parseScoreInput(''), null);
  assert.equal(parseScoreInput('.'), null);
  assert.equal(parseScoreInput('abc'), null);
});

test('scoreColor returns a 6-digit hex and matches anchor colors', () => {
  assert.match(scoreColor(6), /^#[0-9a-f]{6}$/);
  assert.equal(scoreColor(0), '#e24b4a');
  assert.equal(scoreColor(5), '#ef9f27');
  assert.equal(scoreColor(10), '#1d9e75');
});
