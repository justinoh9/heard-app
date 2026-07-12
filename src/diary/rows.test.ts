import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatDiaryDate,
  fromDiaryRow,
  groupByDay,
  sortDiary,
  toDiaryRow,
  type DiaryRow,
} from './rows';
import type { DiaryEntry } from './types';

const ROW: DiaryRow = {
  id: 'd1',
  user_id: 'u1',
  item_id: 'i1',
  item_type: 'album',
  item_title: 'Blonde',
  item_artist: 'Frank Ocean',
  item_art_url: 'http://a/1.jpg',
  score: 9.5,
  note: 'still perfect',
  logged_at: '2026-07-12',
  created_at: '2026-07-12T10:00:00.000Z',
};

const entry = (
  id: string,
  loggedAt: string,
  createdAt: string,
): DiaryEntry => ({
  id,
  userId: 'u1',
  item: { id: `i-${id}`, type: 'album', title: id, artist: 'x' },
  score: 8,
  loggedAt,
  createdAt,
});

test('fromDiaryRow maps every column, nulls → undefined', () => {
  const e = fromDiaryRow(ROW);
  assert.equal(e.item.title, 'Blonde');
  assert.equal(e.item.artUrl, 'http://a/1.jpg');
  assert.equal(e.score, 9.5);
  assert.equal(e.note, 'still perfect');
  assert.equal(e.loggedAt, '2026-07-12');

  const bare = fromDiaryRow({ ...ROW, item_art_url: null, note: null, score: null });
  assert.equal(bare.item.artUrl, undefined);
  assert.equal(bare.note, undefined);
  assert.equal(bare.score, 0);
});

test('toDiaryRow round-trips through fromDiaryRow (minus generated fields)', () => {
  const e = fromDiaryRow(ROW);
  const row = toDiaryRow(e);
  assert.equal(row.user_id, 'u1');
  assert.equal(row.item_id, 'i1');
  assert.equal(row.logged_at, '2026-07-12');
  assert.equal(row.note, 'still perfect');
});

test('sortDiary is newest day first, newest write within a day', () => {
  const a = entry('a', '2026-07-10', '2026-07-10T09:00:00Z');
  const b = entry('b', '2026-07-12', '2026-07-12T08:00:00Z');
  const c = entry('c', '2026-07-12', '2026-07-12T20:00:00Z');
  assert.deepEqual(
    sortDiary([a, b, c]).map((e) => e.id),
    ['c', 'b', 'a'],
  );
});

test('groupByDay buckets entries into newest-first day sections', () => {
  const a = entry('a', '2026-07-10', '2026-07-10T09:00:00Z');
  const b = entry('b', '2026-07-12', '2026-07-12T08:00:00Z');
  const c = entry('c', '2026-07-12', '2026-07-12T20:00:00Z');
  const days = groupByDay([a, b, c]);
  assert.deepEqual(days.map((d) => d.date), ['2026-07-12', '2026-07-10']);
  assert.deepEqual(days[0].entries.map((e) => e.id), ['c', 'b']);
  assert.deepEqual(days[1].entries.map((e) => e.id), ['a']);
});

test('formatDiaryDate renders a friendly label without timezone drift', () => {
  assert.equal(formatDiaryDate('2026-07-12'), 'Jul 12, 2026');
  assert.equal(formatDiaryDate('2026-01-01'), 'Jan 1, 2026');
  assert.equal(formatDiaryDate('garbage'), 'garbage');
});
