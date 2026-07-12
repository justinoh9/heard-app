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

// The viewer follows maya + devon; "stranger" is not followed.
const FRIENDS = new Set(['maya', 'devon']);
const COMMENTS: Comment[] = [
  comment('a', 'maya', '2026-06-01T10:00:00Z'),
  comment('b', 'stranger', '2026-06-03T10:00:00Z'),
  comment('c', 'devon', '2026-06-02T10:00:00Z'),
];

test('everyone scope keeps all comments', () => {
  const out = filterSortComments(COMMENTS, { scope: 'everyone', sort: 'newest' });
  assert.equal(out.length, 3);
});

test('friends scope keeps only comments from followed users', () => {
  const out = filterSortComments(COMMENTS, { scope: 'friends', sort: 'newest', friends: FRIENDS });
  assert.deepEqual(out.map((c) => c.displayName).sort(), ['devon', 'maya']);
});

test('friends scope with no follow set is empty', () => {
  const out = filterSortComments(COMMENTS, { scope: 'friends', sort: 'newest' });
  assert.equal(out.length, 0);
});

test('newest sorts descending by time, oldest ascending', () => {
  const ids = (sort: CommentSort) =>
    filterSortComments(COMMENTS, { scope: 'everyone', sort }).map((c) => c.id);
  assert.deepEqual(ids('newest'), ['b', 'c', 'a']);
  assert.deepEqual(ids('oldest'), ['a', 'c', 'b']);
});

test('isFriendComment matches case/whitespace-insensitively', () => {
  assert.equal(isFriendComment(comment('x', '  MAYA ', '2026-06-01T10:00:00Z'), FRIENDS), true);
  assert.equal(isFriendComment(comment('y', 'nobody', '2026-06-01T10:00:00Z'), FRIENDS), false);
});

test('does not mutate the input array', () => {
  const copy = [...COMMENTS];
  filterSortComments(COMMENTS, { scope: 'everyone', sort: 'oldest' });
  assert.deepEqual(COMMENTS, copy);
});
