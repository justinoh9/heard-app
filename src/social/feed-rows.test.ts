/** Unit tests for the pure social feed helpers (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fromFeedRow, initialsOf, sortEvents, toDisplayEvent, toFeedRow } from './feed-rows';
import type { SocialEvent } from './types';

const ratedEvent: SocialEvent = {
  id: 'e1',
  userId: 'u1',
  displayName: 'Eddie Guan',
  type: 'rated',
  payload: {
    itemId: 'sp-1',
    itemType: 'album',
    title: 'Blonde',
    artist: 'Frank Ocean',
    artUrl: 'https://img/b.jpg',
    score: 9.5,
  },
  createdAt: '2026-07-02T12:00:00.000Z',
};

describe('feed rows', () => {
  it('round-trips an event through the row shape', () => {
    assert.deepEqual(fromFeedRow(toFeedRow(ratedEvent)), ratedEvent);
  });

  it('tolerates a null payload from the DB', () => {
    const row = { ...toFeedRow(ratedEvent), payload: undefined as never };
    assert.deepEqual(fromFeedRow(row).payload, {});
  });
});

describe('initialsOf', () => {
  it('takes first + last initials of multi-word names', () => {
    assert.equal(initialsOf('Eddie Guan'), 'EG');
    assert.equal(initialsOf('frank  ocean jr'), 'FJ');
  });

  it('single-word names get one initial; blank gets a placeholder', () => {
    assert.equal(initialsOf('maya'), 'M');
    assert.equal(initialsOf('   '), '?');
  });
});

describe('toDisplayEvent', () => {
  it('maps a rated event onto the feed-card shape', () => {
    const card = toDisplayEvent(ratedEvent);
    assert.equal(card.kind, 'rated');
    assert.equal(card.user, 'Eddie Guan');
    assert.equal(card.initials, 'EG');
    assert.equal(card.title, 'Blonde');
    assert.equal(card.score, 9.5);
    assert.equal(card.itemId, 'sp-1');
    assert.equal(card.createdAt, ratedEvent.createdAt);
    assert.equal(card.likes, 0);
  });

  it('maps a drop with its caption as the quoted line', () => {
    const card = toDisplayEvent({
      ...ratedEvent,
      type: 'drop',
      payload: { ...ratedEvent.payload, score: undefined, caption: 'on repeat' },
    });
    assert.equal(card.kind, 'drop');
    assert.equal(card.review, 'on repeat');
    assert.equal(card.score, undefined);
  });

  it('maps a streak event without any item linkage', () => {
    const card = toDisplayEvent({
      ...ratedEvent,
      type: 'streak',
      payload: { days: 30 },
    });
    assert.equal(card.kind, 'streak');
    assert.equal(card.title, 'hit a 30-day streak');
    assert.equal(card.itemId, undefined);
    assert.equal(card.coverUrl, undefined);
  });
});

describe('sortEvents', () => {
  it('sorts newest first without mutating the input', () => {
    const older = { ...ratedEvent, id: 'old', createdAt: '2026-07-01T00:00:00.000Z' };
    const input = [older, ratedEvent];
    const out = sortEvents(input);
    assert.deepEqual(out.map((e) => e.id), ['e1', 'old']);
    assert.deepEqual(input.map((e) => e.id), ['old', 'e1']);
  });
});
