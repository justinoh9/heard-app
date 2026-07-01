import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarize } from './aggregate';

test('summarize counts rows per target and flags the current user', () => {
  const rows = [
    { targetId: 'a', userId: 'u1' },
    { targetId: 'a', userId: 'u2' },
    { targetId: 'b', userId: 'u2' },
  ];
  const summaries = summarize(rows, ['a', 'b'], 'u1');

  assert.deepEqual(summaries.get('a'), { targetId: 'a', count: 2, likedByMe: true });
  assert.deepEqual(summaries.get('b'), { targetId: 'b', count: 1, likedByMe: false });
});

test('summarize includes requested targets with zero likes', () => {
  const summaries = summarize([], ['a', 'b'], 'u1');
  assert.deepEqual(summaries.get('a'), { targetId: 'a', count: 0, likedByMe: false });
  assert.deepEqual(summaries.get('b'), { targetId: 'b', count: 0, likedByMe: false });
});

test('summarize ignores rows for targets that were not requested', () => {
  const rows = [{ targetId: 'unrequested', userId: 'u1' }];
  const summaries = summarize(rows, ['a'], 'u1');
  assert.equal(summaries.has('unrequested'), false);
  assert.deepEqual(summaries.get('a'), { targetId: 'a', count: 0, likedByMe: false });
});

test('summarize treats an anonymous user id as never liking anything', () => {
  const rows = [{ targetId: 'a', userId: 'u1' }];
  const summaries = summarize(rows, ['a'], '');
  assert.equal(summaries.get('a')?.likedByMe, false);
});
