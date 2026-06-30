import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterSortComments, isFriendComment, type CommentSort } from './filter';
import type { Comment } from './types';

function comment(id: string, displayName: string, createdAt: string): Comment {
  return {
    id,
    itemId: 'item-1',
    itemType: 'album',
    itemTitle: 'SOS',
    itemArtist: 'SZA',
    userId: `u-${id}`,
    displayName,
    body: `comment ${id}`,
    createdAt,
  };
}

// maya/devon are friends (in LEADERBOARD_USERS); "stranger" is not.
const COMMENTS: Comment[] = [
  comment('a', 'maya', '2026-06-01T10:00:00Z'),
  comment('b', 'stranger', '2026-06-03T10:00:00Z'),
  comment('c', 'devon', '2026-06-02T10:00:00Z'),
];

test('everyone scope keeps all comments', () => {
  const out = filterSortComments(COMMENTS, { scope: 'everyone', sort: 'newest' });
  assert.equal(out.length, 3);
});

test('friends scope keeps only friend-authored comments', () => {
  const out = filterSortComments(COMMENTS, { scope: 'friends', sort: 'newest' });
  assert.deepEqual(out.map((c) => c.displayName).sort(), ['devon', 'maya']);
});

test('newest sorts descending by time, oldest ascending', () => {
  const ids = (sort: CommentSort) =>
    filterSortComments(COMMENTS, { scope: 'everyone', sort }).map((c) => c.id);
  assert.deepEqual(ids('newest'), ['b', 'c', 'a']);
  assert.deepEqual(ids('oldest'), ['a', 'c', 'b']);
});

test('isFriendComment matches case/whitespace-insensitively', () => {
  assert.equal(isFriendComment(comment('x', '  MAYA ', '2026-06-01T10:00:00Z')), true);
  assert.equal(isFriendComment(comment('y', 'nobody', '2026-06-01T10:00:00Z')), false);
});

test('a custom friend set overrides the default roster', () => {
  const friends = new Set(['stranger']);
  const out = filterSortComments(COMMENTS, { scope: 'friends', sort: 'newest', friends });
  assert.deepEqual(out.map((c) => c.displayName), ['stranger']);
});

test('does not mutate the input array', () => {
  const copy = [...COMMENTS];
  filterSortComments(COMMENTS, { scope: 'everyone', sort: 'oldest' });
  assert.deepEqual(COMMENTS, copy);
});
