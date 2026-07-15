import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  countByStatus,
  fromAdminReportRow,
  groupReports,
  isRemovableTarget,
  triageOrder,
  type AdminReportRow,
} from './admin-rows';
import type { AdminReport } from './types';

const row = (over: Partial<AdminReportRow> = {}): AdminReportRow => ({
  id: 'r1',
  reporter_id: 'u-reporter',
  target_type: 'comment',
  target_id: 'c1',
  target_user_id: 'u-author',
  reason: 'spam',
  note: null,
  status: 'open',
  created_at: '2026-07-15T10:00:00.000Z',
  reviewed_by: null,
  reviewed_at: null,
  ...over,
});

const rep = (over: Partial<AdminReport> = {}): AdminReport => ({
  id: 'r1',
  reporterId: 'u-reporter',
  targetType: 'comment',
  targetId: 'c1',
  reason: 'spam',
  status: 'open',
  createdAt: '2026-07-15T10:00:00.000Z',
  ...over,
});

// ---- row mapping ----------------------------------------------------------

test('maps a full row', () => {
  const r = fromAdminReportRow(
    row({ status: 'actioned', note: 'bad', reviewed_by: 'admin-1', reviewed_at: '2026-07-15T11:00:00.000Z' }),
  );
  assert.equal(r.id, 'r1');
  assert.equal(r.reporterId, 'u-reporter');
  assert.equal(r.targetType, 'comment');
  assert.equal(r.targetUserId, 'u-author');
  assert.equal(r.reason, 'spam');
  assert.equal(r.note, 'bad');
  assert.equal(r.status, 'actioned');
  assert.equal(r.reviewedBy, 'admin-1');
  assert.equal(r.reviewedAt, '2026-07-15T11:00:00.000Z');
});

test('nulls become undefined, not null', () => {
  const r = fromAdminReportRow(row({ target_user_id: null, note: null, reviewed_by: null }));
  assert.equal(r.targetUserId, undefined);
  assert.equal(r.note, undefined);
  assert.equal(r.reviewedBy, undefined);
});

test('an unknown status reads as open, so it stays in the queue', () => {
  // The safe direction: an unrecognized value must never look "already handled".
  assert.equal(fromAdminReportRow(row({ status: 'wat' })).status, 'open');
  assert.equal(fromAdminReportRow(row({ status: null })).status, 'open');
});

test('unknown target types and reasons fall back rather than throwing', () => {
  assert.equal(fromAdminReportRow(row({ target_type: 'playlist' })).targetType, 'user');
  assert.equal(fromAdminReportRow(row({ reason: 'vibes' })).reason, 'other');
});

// ---- triage ---------------------------------------------------------------

test('open reports sort above handled ones regardless of age', () => {
  const old_open = rep({ id: 'old-open', status: 'open', createdAt: '2026-01-01T00:00:00.000Z' });
  const new_done = rep({ id: 'new-done', status: 'dismissed', createdAt: '2026-07-15T00:00:00.000Z' });
  const order = triageOrder([new_done, old_open]).map((r) => r.id);
  assert.deepEqual(order, ['old-open', 'new-done']);
});

test('within the same status, newest first', () => {
  const a = rep({ id: 'a', createdAt: '2026-07-01T00:00:00.000Z' });
  const b = rep({ id: 'b', createdAt: '2026-07-10T00:00:00.000Z' });
  assert.deepEqual(triageOrder([a, b]).map((r) => r.id), ['b', 'a']);
});

test('triageOrder does not mutate its input', () => {
  const input = [rep({ id: 'a', status: 'dismissed' }), rep({ id: 'b', status: 'open' })];
  triageOrder(input);
  assert.deepEqual(input.map((r) => r.id), ['a', 'b']);
});

test('countByStatus always reports every status key', () => {
  const counts = countByStatus([rep({ status: 'open' }), rep({ status: 'open' }), rep({ status: 'actioned' })]);
  assert.deepEqual(counts, { open: 2, reviewed: 0, actioned: 1, dismissed: 0 });
});

// ---- grouping -------------------------------------------------------------

test('reports about the same target collapse into one group', () => {
  const groups = groupReports([
    rep({ id: 'r1', targetId: 'c1', reporterId: 'u1' }),
    rep({ id: 'r2', targetId: 'c1', reporterId: 'u2' }),
    rep({ id: 'r3', targetId: 'c2', reporterId: 'u3' }),
  ]);
  assert.equal(groups.length, 2);
  const first = groups.find((g) => g.targetId === 'c1')!;
  assert.equal(first.reports.length, 2, 'ten people reporting one comment is one decision');
});

test('a group is separated by target type, not just id', () => {
  const groups = groupReports([
    rep({ id: 'r1', targetType: 'comment', targetId: 'x' }),
    rep({ id: 'r2', targetType: 'feed_event', targetId: 'x' }),
  ]);
  assert.equal(groups.length, 2);
});

test('hasOpen is true when any report in the group still needs a decision', () => {
  const groups = groupReports([
    rep({ id: 'r1', targetId: 'c1', status: 'dismissed' }),
    rep({ id: 'r2', targetId: 'c1', status: 'open' }),
  ]);
  assert.equal(groups[0].hasOpen, true);
});

test('hasOpen is false once every report in the group is handled', () => {
  const groups = groupReports([
    rep({ id: 'r1', targetId: 'c1', status: 'dismissed' }),
    rep({ id: 'r2', targetId: 'c1', status: 'actioned' }),
  ]);
  assert.equal(groups[0].hasOpen, false);
});

test('a group recovers the reported author from whichever report knows it', () => {
  const groups = groupReports([
    rep({ id: 'r1', targetId: 'c1', targetUserId: undefined }),
    rep({ id: 'r2', targetId: 'c1', targetUserId: 'u-author' }),
  ]);
  assert.equal(groups[0].targetUserId, 'u-author');
});

test('groups with an open report come first', () => {
  const groups = groupReports([
    rep({ id: 'r1', targetId: 'handled', status: 'dismissed', createdAt: '2026-07-15T00:00:00.000Z' }),
    rep({ id: 'r2', targetId: 'fresh', status: 'open', createdAt: '2026-01-01T00:00:00.000Z' }),
  ]);
  assert.equal(groups[0].targetId, 'fresh');
});

// ---- removable ------------------------------------------------------------

test('only free-text surfaces are removable by a moderator', () => {
  assert.equal(isRemovableTarget('comment'), true);
  assert.equal(isRemovableTarget('feed_event'), true);
  // A rating is a number; removing someone's honest 7/10 is not moderation.
  assert.equal(isRemovableTarget('rating'), false);
  assert.equal(isRemovableTarget('user'), false);
  assert.equal(isRemovableTarget('concert'), false);
});
