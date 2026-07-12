import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dropRemainingMs,
  formatDropRemaining,
  fromDropRow,
  isActiveDrop,
  toDropRow,
  type DropRow,
} from './rows';
import { DROP_TTL_MS, type DailyDrop } from './types';

const ROW: DropRow = {
  user_id: 'u1',
  item_id: 'i1',
  item_type: 'album',
  item_title: 'Blonde',
  item_artist: 'Frank Ocean',
  item_art_url: 'http://art/1.jpg',
  caption: 'on repeat',
  created_at: '2026-07-12T00:00:00.000Z',
};

test('fromDropRow maps every column, nulls → undefined', () => {
  const drop = fromDropRow(ROW);
  assert.equal(drop.userId, 'u1');
  assert.equal(drop.item.id, 'i1');
  assert.equal(drop.item.type, 'album');
  assert.equal(drop.item.title, 'Blonde');
  assert.equal(drop.item.artist, 'Frank Ocean');
  assert.equal(drop.item.artUrl, 'http://art/1.jpg');
  assert.equal(drop.caption, 'on repeat');

  const bare = fromDropRow({ ...ROW, item_art_url: null, caption: null });
  assert.equal(bare.item.artUrl, undefined);
  assert.equal(bare.caption, undefined);
});

test('toDropRow round-trips through fromDropRow', () => {
  assert.deepEqual(fromDropRow(toDropRow(fromDropRow(ROW))), fromDropRow(ROW));
});

test('toDropRow writes undefined optionals as null', () => {
  const drop: DailyDrop = {
    userId: 'u2',
    item: { id: 'i2', type: 'song', title: 'Nights', artist: 'Frank Ocean' },
    createdAt: '2026-07-12T00:00:00.000Z',
  };
  const row = toDropRow(drop);
  assert.equal(row.item_art_url, null);
  assert.equal(row.caption, null);
});

test('isActiveDrop is true within 24h, false after', () => {
  const base = Date.parse(ROW.created_at);
  const drop = fromDropRow(ROW);
  assert.equal(isActiveDrop(drop, base + 1000), true);
  assert.equal(isActiveDrop(drop, base + DROP_TTL_MS - 1), true);
  assert.equal(isActiveDrop(drop, base + DROP_TTL_MS), false);
  assert.equal(isActiveDrop(drop, base + DROP_TTL_MS + 1000), false);
});

test('dropRemainingMs never goes negative', () => {
  const base = Date.parse(ROW.created_at);
  const drop = fromDropRow(ROW);
  assert.equal(dropRemainingMs(drop, base), DROP_TTL_MS);
  assert.equal(dropRemainingMs(drop, base + DROP_TTL_MS + 5000), 0);
});

test('formatDropRemaining renders hours, minutes, and the sub-minute floor', () => {
  const base = Date.parse(ROW.created_at);
  const drop = fromDropRow(ROW);
  assert.equal(formatDropRemaining(drop, base), '24h left');
  assert.equal(formatDropRemaining(drop, base + 1000), '23h left'); // 23h59m floors down
  assert.equal(formatDropRemaining(drop, base + DROP_TTL_MS - 90 * 60000), '1h left');
  assert.equal(formatDropRemaining(drop, base + DROP_TTL_MS - 42 * 60000), '42m left');
  assert.equal(formatDropRemaining(drop, base + DROP_TTL_MS - 30000), '<1m left');
});
