/**
 * Moderation seam (ROADMAP Phase 4): blocking and reporting — the safety floor
 * a public launch of user-generated content needs.
 *
 * Screens talk to `useModeration()` (store.tsx); persistence sits behind
 * `ModerationBackend` (Supabase `0019_moderation.sql`, or an on-device
 * fallback), same shape as the ratings/social/concerts seams.
 *
 * Unlike every other table in this app, blocks and reports are **private
 * reads** — see the migration's header for why.
 */

/** Why something was reported. Mirrors the DB's check constraint. */
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'self_harm'
  | 'other';

/** What kind of thing was reported. */
export type ReportTargetType = 'user' | 'comment' | 'rating' | 'concert' | 'feed_event';

export interface NewReport {
  reporterId: string;
  targetType: ReportTargetType;
  /** The reported row's id — or the user's id when reporting a person. */
  targetId: string;
  /** Author of the reported content, denormalized so triage needs no joins. */
  targetUserId?: string;
  reason: ReportReason;
  note?: string;
}

/** Human labels for the report sheet, in the order they're shown. */
export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam or scam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'violence', label: 'Violence or threats' },
  { key: 'self_harm', label: 'Self-harm' },
  { key: 'other', label: 'Something else' },
];

/**
 * Where a report sits in triage (mirrors the DB check constraint).
 * `reviewed` = looked at, no action. `actioned` = looked at, content removed.
 * Keeping those distinct is what makes "we looked and it was fine" different
 * from "nobody has looked yet", which is the only question triage really asks.
 */
export type ReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed';

/**
 * A report as a reviewer sees it. Only admins can load these — RLS (0023) is
 * what enforces that, not this type.
 */
export interface AdminReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  reason: ReportReason;
  note?: string;
  status: ReportStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

/** Thrown for expected persistence failures — UI-safe message. */
export class ModerationError extends Error {}

export interface ModerationBackend {
  /** User ids the viewer has blocked. */
  blockedBy(userId: string): Promise<string[]>;
  /** Block or unblock `targetId` on the viewer's behalf. */
  setBlocked(userId: string, targetId: string, blocked: boolean): Promise<void>;
  /**
   * File a report. Re-reporting the same target is a successful no-op — the DB
   * has a unique constraint, and telling someone "you already reported this"
   * is friendlier than an error.
   */
  report(input: NewReport): Promise<void>;
  /** `reportKey()`s the viewer has already filed, so the UI can say so. */
  reportedKeys(userId: string): Promise<string[]>;
  /**
   * Sever the follow in both directions — blocking someone who follows you
   * must stop them seeing your activity, not just hide them from your feed.
   */
  severFollows(userId: string, targetId: string): Promise<void>;

  // ---- Review surface (0023). Admin-only, enforced in the database. --------

  /**
   * Whether the signed-in user may review reports. This is a convenience for
   * the UI — it decides whether to render the entrance — and is NOT the security
   * boundary. A client that lies here still gets nothing: RLS scopes the report
   * rows themselves. Treat a `true` as "show the door", never as "grant access".
   */
  isAdmin(): Promise<boolean>;

  /** Reports for triage, newest first. Empty for non-admins (RLS, not a check here). */
  listReports(status?: ReportStatus): Promise<AdminReport[]>;

  /**
   * Move a report through triage. The reviewer's identity and timestamp are
   * stamped by the database from the JWT, not passed from here — the client
   * cannot name who did the reviewing.
   */
  setReportStatus(id: string, status: ReportStatus): Promise<void>;

  /** Remove reported content as a moderator. Admin-only via RLS (0023). */
  deleteReportedContent(targetType: ReportTargetType, targetId: string): Promise<void>;
}
