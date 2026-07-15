/**
 * Pure blocking filters — the read-side half of the moderation feature.
 *
 * Kept pure and separate because "does the blocked user actually disappear?" is
 * exactly the kind of invariant that rots silently: a new surface gets added,
 * nobody filters it, and the user who blocked their harasser still sees them.
 * The stores route every list through here, and these tests are the contract.
 *
 * Scope, honestly stated: this hides blocked users from the *viewer's* reads.
 * The rows are still fetched and still public — this is not a privacy boundary,
 * it's "I don't have to see you". The server-side half lives in
 * `0019_moderation.sql`, which stops a blocked user following or tagging you.
 */

/** A row that carries an author id, plus optional repost attribution. */
export interface Authored {
  userId: string;
}

/**
 * Every user id a feed event is attributable to. A repost carries its original
 * author in the payload, so blocking someone must also hide other people's
 * reposts *of* them — otherwise they reappear second-hand.
 */
export function feedAuthors(event: {
  userId: string;
  payload?: { originalUserId?: string };
}): string[] {
  const ids = [event.userId];
  const original = event.payload?.originalUserId;
  if (original) ids.push(original);
  return ids;
}

/** True when any of `ids` is blocked. */
export function anyBlocked(ids: readonly (string | undefined)[], blocked: ReadonlySet<string>): boolean {
  if (blocked.size === 0) return false;
  return ids.some((id) => id !== undefined && blocked.has(id));
}

/**
 * Drop rows authored by a blocked user. `authorsOf` returns every id the row is
 * attributable to (usually one; a repost has two).
 */
export function hideBlocked<T>(
  rows: readonly T[],
  blocked: ReadonlySet<string>,
  authorsOf: (row: T) => readonly (string | undefined)[],
): T[] {
  // Fast path: the overwhelmingly common case is an empty block list, and
  // this runs on every feed/comment render.
  if (blocked.size === 0) return [...rows];
  return rows.filter((row) => !anyBlocked(authorsOf(row), blocked));
}

/** Drop rows whose single `userId` is blocked — comments, profiles, events. */
export function hideBlockedAuthors<T extends Authored>(
  rows: readonly T[],
  blocked: ReadonlySet<string>,
): T[] {
  return hideBlocked(rows, blocked, (r) => [r.userId]);
}

/** Drop feed events by a blocked author *or* reposted from one. */
export function hideBlockedEvents<T extends { userId: string; payload?: { originalUserId?: string } }>(
  events: readonly T[],
  blocked: ReadonlySet<string>,
): T[] {
  return hideBlocked(events, blocked, feedAuthors);
}

/**
 * Drop blocked people from the directory. Profiles key on `userId` but aren't
 * "authored", so they get their own accessor rather than bending `Authored`.
 */
export function hideBlockedProfiles<T extends { userId: string }>(
  profiles: readonly T[],
  blocked: ReadonlySet<string>,
): T[] {
  return hideBlocked(profiles, blocked, (p) => [p.userId]);
}

/**
 * Stable key for "have I already reported this?". Mirrors the DB's
 * `unique (reporter_id, target_type, target_id)`.
 */
export function reportKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}
