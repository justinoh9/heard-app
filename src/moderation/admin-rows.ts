/**
 * Pure row↔model mapping + triage helpers for the report review surface
 * (0023_admin_review.sql). Same posture as every other `rows.ts` here: the
 * backend does transport, this file holds every decision, and the tests cover
 * this file rather than the network.
 */

import type {
  AdminReport,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from './types';

/** The shape Supabase returns from `select *` on public.reports. */
export interface AdminReportRow {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  target_user_id?: string | null;
  reason: string;
  note?: string | null;
  status?: string | null;
  created_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

const STATUSES: ReportStatus[] = ['open', 'reviewed', 'actioned', 'dismissed'];
const TARGET_TYPES: ReportTargetType[] = ['user', 'comment', 'rating', 'concert', 'feed_event'];
const REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'self_harm',
  'other',
];

/**
 * Read a row defensively rather than trusting the check constraints. The DB does
 * constrain these columns, but this app has already learned that a table can
 * predate its constraint (0017 backfilled concert_tags.status onto rows written
 * before the column existed). A reviewer seeing 'open' for an unrecognized status
 * is right — it means "nobody has dealt with this" — whereas a crash in triage
 * means nobody deals with any of them.
 */
export function fromAdminReportRow(row: AdminReportRow): AdminReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetType: TARGET_TYPES.includes(row.target_type as ReportTargetType)
      ? (row.target_type as ReportTargetType)
      : 'user',
    targetId: row.target_id,
    targetUserId: row.target_user_id ?? undefined,
    reason: REASONS.includes(row.reason as ReportReason) ? (row.reason as ReportReason) : 'other',
    note: row.note ?? undefined,
    status: STATUSES.includes((row.status ?? '') as ReportStatus)
      ? (row.status as ReportStatus)
      : 'open',
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

/** Human labels, used by the triage filter chips and the row badges. */
export const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  actioned: 'Actioned',
  dismissed: 'Dismissed',
};

export const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or scam',
  harassment: 'Harassment',
  hate: 'Hate speech',
  sexual: 'Sexual content',
  violence: 'Violence or threats',
  self_harm: 'Self-harm',
  other: 'Something else',
};

export const TARGET_LABELS: Record<ReportTargetType, string> = {
  user: 'Account',
  comment: 'Comment',
  rating: 'Rating',
  concert: 'Show',
  feed_event: 'Post',
};

/** Only these can be removed by a moderator — see 0023 for why not ratings/shows. */
export function isRemovableTarget(t: ReportTargetType): boolean {
  return t === 'comment' || t === 'feed_event';
}

/** Counts per status, for the filter chips. Always includes every status key. */
export function countByStatus(reports: AdminReport[]): Record<ReportStatus, number> {
  const out: Record<ReportStatus, number> = {
    open: 0,
    reviewed: 0,
    actioned: 0,
    dismissed: 0,
  };
  for (const r of reports) out[r.status] += 1;
  return out;
}

/**
 * Triage order: open first (they're the only ones that need a human), then most
 * recent. Sorting purely by date would bury a fresh report under a wall of
 * already-handled ones the moment the queue gets busy — which is exactly when
 * ordering starts to matter.
 */
export function triageOrder(reports: AdminReport[]): AdminReport[] {
  return [...reports].sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (b.status === 'open' && a.status !== 'open') return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Group reports that point at the same thing. Ten people reporting one comment is
 * one decision, not ten — and the pile-up is itself the strongest signal in the
 * queue, so it should be visible rather than spread across ten rows.
 * Groups are returned in triage order by their most urgent/recent member.
 */
export interface ReportGroup {
  key: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  reports: AdminReport[];
  /** True when any report in the group still needs a decision. */
  hasOpen: boolean;
}

export function groupReports(reports: AdminReport[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const r of triageOrder(reports)) {
    const key = `${r.targetType}:${r.targetId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.reports.push(r);
      existing.hasOpen = existing.hasOpen || r.status === 'open';
      // The denormalized author can be null on older rows; take the first one
      // that actually knows.
      existing.targetUserId = existing.targetUserId ?? r.targetUserId;
    } else {
      groups.set(key, {
        key,
        targetType: r.targetType,
        targetId: r.targetId,
        targetUserId: r.targetUserId,
        reports: [r],
        hasOpen: r.status === 'open',
      });
    }
  }
  return [...groups.values()];
}
