import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildThreads, filterSortComments, isFriendComment, type CommentSort } from './filter';
import type { Comment } from './types';

function comment(
  id: string,
  displayName: string,
  createdAt: string,
  parentId?: string,
): Comment {
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
    parentId,
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

// --- threads ---

const THREADED: Comment[] = [
  comment('root1', 'maya', '2026-06-01T10:00:00Z'),
  comment('root2', 'stranger', '2026-06-03T10:00:00Z'),
  comment('r1b', 'devon', '2026-06-02T09:00:00Z', 'root1'),
  comment('r1a', 'maya', '2026-06-01T11:00:00Z', 'root1'),
];

test('buildThreads groups replies under their parent, oldest-first', () => {
  const threads = buildThreads(THREADED, { scope: 'everyone', sort: 'oldest' });
  assert.deepEqual(threads.map((t) => t.comment.id), ['root1', 'root2']);
  const first = threads.find((t) => t.comment.id === 'root1')!;
  // Replies chronological regardless of the top-level sort.
  assert.deepEqual(first.replies.map((r) => r.id), ['r1a', 'r1b']);
  assert.equal(threads.find((t) => t.comment.id === 'root2')!.replies.length, 0);
});

test('buildThreads sorts top-level newest-first when asked, replies stay oldest-first', () => {
  const threads = buildThreads(THREADED, { scope: 'everyone', sort: 'newest' });
  assert.deepEqual(threads.map((t) => t.comment.id), ['root2', 'root1']);
  const root1 = threads.find((t) => t.comment.id === 'root1')!;
  assert.deepEqual(root1.replies.map((r) => r.id), ['r1a', 'r1b']);
});

test('buildThreads friends scope filters top-level but keeps all replies under a visible root', () => {
  // maya is followed, stranger is not; root1 (maya) stays with its devon reply.
  const threads = buildThreads(THREADED, { scope: 'friends', sort: 'oldest', friends: FRIENDS });
  assert.deepEqual(threads.map((t) => t.comment.id), ['root1']);
  assert.deepEqual(threads[0].replies.map((r) => r.id), ['r1a', 'r1b']);
});

test('buildThreads drops replies whose parent is absent', () => {
  const orphaned = [comment('lonely', 'maya', '2026-06-01T10:00:00Z', 'missing-parent')];
  const threads = buildThreads(orphaned, { scope: 'everyone', sort: 'newest' });
  assert.equal(threads.length, 0);
});

test('buildThreads does not mutate the input array', () => {
  const copy = [...THREADED];
  buildThreads(THREADED, { scope: 'everyone', sort: 'newest' });
  assert.deepEqual(THREADED, copy);
});
