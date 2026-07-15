/** Unit tests for the pure blocking filters (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  anyBlocked,
  feedAuthors,
  hideBlockedAuthors,
  hideBlockedEvents,
  hideBlockedProfiles,
  reportKey,
} from './filter';

const BLOCKED = new Set(['villain']);
const NONE = new Set<string>();

function event(userId: string, originalUserId?: string) {
  return {
    id: `${userId}-${originalUserId ?? 'own'}`,
    userId,
    payload: originalUserId ? { originalUserId } : {},
  };
}

describe('feedAuthors', () => {
  it('attributes an ordinary event to its author', () => {
    assert.deepEqual(feedAuthors(event('maya')), ['maya']);
  });

  it('attributes a repost to both the reposter and the original author', () => {
    assert.deepEqual(feedAuthors(event('maya', 'villain')), ['maya', 'villain']);
  });

  it('tolerates a missing payload', () => {
    assert.deepEqual(feedAuthors({ userId: 'maya' }), ['maya']);
  });
});

describe('anyBlocked', () => {
  it('is false for an empty block list', () => {
    assert.equal(anyBlocked(['villain'], NONE), false);
  });

  it('ignores undefined ids rather than matching on them', () => {
    assert.equal(anyBlocked([undefined], BLOCKED), false);
  });

  it('is true when any id is blocked', () => {
    assert.equal(anyBlocked(['maya', 'villain'], BLOCKED), true);
    assert.equal(anyBlocked(['maya', 'sam'], BLOCKED), false);
  });
});

describe('hideBlockedEvents', () => {
  it('hides a blocked author', () => {
    const events = [event('maya'), event('villain'), event('sam')];
    assert.deepEqual(
      hideBlockedEvents(events, BLOCKED).map((e) => e.userId),
      ['maya', 'sam'],
    );
  });

  it('hides a blocked user reappearing second-hand through a repost', () => {
    // The whole point: blocking someone must not leave their content visible
    // just because a friend reshared it.
    const events = [event('maya', 'villain'), event('sam')];
    assert.deepEqual(
      hideBlockedEvents(events, BLOCKED).map((e) => e.userId),
      ['sam'],
    );
  });

  it('keeps a repost of an unblocked user by an unblocked reposter', () => {
    assert.equal(hideBlockedEvents([event('maya', 'sam')], BLOCKED).length, 1);
  });

  it('hides a blocked reposter even when the original is fine', () => {
    assert.equal(hideBlockedEvents([event('villain', 'sam')], BLOCKED).length, 0);
  });

  it('returns everything when nothing is blocked', () => {
    const events = [event('maya'), event('villain')];
    assert.equal(hideBlockedEvents(events, NONE).length, 2);
  });

  it('does not mutate the input', () => {
    const events = [event('maya'), event('villain')];
    const copy = [...events];
    hideBlockedEvents(events, BLOCKED);
    assert.deepEqual(events, copy);
  });
});

describe('hideBlockedAuthors', () => {
  it('drops comments by a blocked user', () => {
    const comments = [
      { userId: 'maya', body: 'love this' },
      { userId: 'villain', body: 'be quiet' },
    ];
    assert.deepEqual(
      hideBlockedAuthors(comments, BLOCKED).map((c) => c.userId),
      ['maya'],
    );
  });

  it('returns a copy, not the same array, so callers can sort freely', () => {
    const comments = [{ userId: 'maya' }];
    assert.notEqual(hideBlockedAuthors(comments, NONE), comments);
  });
});

describe('hideBlockedProfiles', () => {
  it('drops blocked people from the directory', () => {
    const people = [{ userId: 'maya' }, { userId: 'villain' }];
    assert.deepEqual(
      hideBlockedProfiles(people, BLOCKED).map((p) => p.userId),
      ['maya'],
    );
  });
});

describe('reportKey', () => {
  it('matches the DB uniqueness tuple', () => {
    assert.equal(reportKey('comment', 'abc'), 'comment:abc');
  });

  it('keeps the same id distinct across target types', () => {
    assert.notEqual(reportKey('comment', 'x1'), reportKey('user', 'x1'));
  });
});
