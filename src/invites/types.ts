/**
 * Invites seam (ROADMAP Phase 4 / F6). A referral link that seeds the follow
 * graph — see `0028_invites.sql` for why this is NOT invite-gated signup.
 *
 * Everything meaningful happens in two SECURITY DEFINER functions. That is the
 * design, not an implementation detail: a code is a bearer token, so the client
 * is never allowed to read the table by code, and the invitee is never allowed to
 * write the follow that makes the *inviter* follow them back.
 */

/** One of the viewer's codes. */
export interface Invite {
  code: string;
  /** Set once someone has joined with it. */
  inviteeId?: string;
  redeemedAt?: string;
}

/** Thrown for expected persistence failures — UI-safe message. */
export class InvitesError extends Error {}

export interface InvitesBackend {
  /**
   * The viewer's codes, topping up to `target` unredeemed ones. Idempotent — safe
   * to call on every screen open, because the cap lives in the database.
   */
  mine(target?: number): Promise<Invite[]>;
  /**
   * Claim a code. Resolves to the inviter's user id, or `null` when the code is
   * unusable for ANY reason — wrong, spent, yours, or you've already used one.
   *
   * The single null is deliberate and comes from the database: distinguishing
   * "no such code" from "already taken" would make this an oracle to test guesses
   * against. The UI says one thing for all of them, and that's honest rather than
   * lazy.
   */
  redeem(code: string): Promise<string | null>;
}
