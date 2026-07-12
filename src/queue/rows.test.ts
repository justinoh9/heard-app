/** Unit tests for the want-to-listen queue row mapping (offline, pure). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fromQueueRow, sortQueue, toQueueRow, type QueueRow } from './rows';
import type { QueueInput, QueueItem } from './types';

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: 'q1',
  user_id: 'u1',
  item_id: 'album-1',
  item_type: 'album',
  item_title: 'Blonde',
  item_artist: 'Frank Ocean',
  item_art_url: 'http://art/1.jpg',
  created_at: '2026-07-12T10:00:00.000Z',
  ...over,
});

describe('queue rows', () => {
  it('round-trips a bookmark through toQueueRow → fromQueueRow', () => {
    const input: QueueInput = {
      userId: 'u1',
      itemId: 'album-1',
      type: 'album',
      title: 'Blonde',
      artist: 'Frank Ocean',
      artUrl: 'http://art/1.jpg',
    };
    const persisted = toQueueRow(input);
    assert.deepEqual(persisted, {
      user_id: 'u1',
      item_id: 'album-1',
      item_type: 'album',
      item_title: 'Blonde',
      item_artist: 'Frank Ocean',
      item_art_url: 'http://art/1.jpg',
    });
    const model = fromQueueRow(row());
    assert.equal(model.itemId, 'album-1');
    assert.equal(model.type, 'album');
    assert.equal(model.artUrl, 'http://art/1.jpg');
  });

  it('maps a null art_url to undefined', () => {
    assert.equal(fromQueueRow(row({ item_art_url: null })).artUrl, undefined);
  });

  it('sortQueue orders newest bookmark first', () => {
    const items: QueueItem[] = [
      { id: 'a', itemId: 'a', type: 'song', title: 'A', artist: 'x', createdAt: '2026-07-10T00:00:00Z' },
      { id: 'b', itemId: 'b', type: 'song', title: 'B', artist: 'x', createdAt: '2026-07-12T00:00:00Z' },
      { id: 'c', itemId: 'c', type: 'song', title: 'C', artist: 'x', createdAt: '2026-07-11T00:00:00Z' },
    ];
    assert.deepEqual(sortQueue(items).map((i) => i.id), ['b', 'c', 'a']);
  });
});
