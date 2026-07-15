/**
 * Analytics seam (ROADMAP Phase 4). Four numbers — sign-up → first log → first
 * follow → D7 return — so the roadmap can be argued from data instead of taste.
 *
 * Persistence sits behind `AnalyticsBackend` (Supabase `0027_analytics.sql`, or
 * an on-device no-op), same shape as every other seam here. Screens don't call it
 * directly: `useAnalytics().track` is the entry point.
 *
 * The privacy posture is in the migration header, and it is short on purpose:
 * signed-in users only, no free text, no third parties, and every row dies with
 * the account (0027 extends `delete_own_account`). If an event ever needs to
 * carry something a person typed, it doesn't belong here.
 */

/**
 * The events. RAW facts, not conclusions — there is no `first_rating`, because
 * "first" is a question for read time. See the migration.
 *
 * A union type rather than free strings so a typo is a compile error instead of
 * a funnel that quietly reads zero. The column is loose text, so adding one here
 * never needs a migration.
 */
export type AnalyticsEventName =
  /** A new account was created. The head of the funnel. */
  | 'signed_up'
  /** The app was opened by a signed-in user. Drives D7 retention. */
  | 'app_opened'
  /** A rating was committed — activation. */
  | 'rated'
  /** Someone was followed — the social connection that makes the feed work. */
  | 'followed'
  /** The onboarding wizard was finished (vs. abandoned midway). */
  | 'onboarding_completed'
  /** A concert was logged — the differentiator we keep betting on. */
  | 'concert_logged'
  /** A share card was exported — the acquisition surface. */
  | 'shared';

/**
 * Small structured facts about an event. Enums and numbers only: this is
 * serialized to `props jsonb` and read by an admin, so anything a user typed
 * would turn an aggregate table into a personal one.
 */
export type AnalyticsProps = Record<string, string | number | boolean>;

/** The four numbers, for one sign-up cohort. */
export interface FunnelCounts {
  signedUp: number;
  activated: number;
  connected: number;
  retainedD7: number;
}

export interface AnalyticsBackend {
  /**
   * Record one event. Fire-and-forget by contract: implementations must not throw
   * — analytics failing is never a reason for a user's action to fail. The store
   * relies on this, and so does every call site that doesn't await it.
   */
  track(userId: string, name: AnalyticsEventName, props?: AnalyticsProps): Promise<void>;
  /** The funnel over the last `days`. Admin-only — enforced in the database. */
  funnel(days: number): Promise<FunnelCounts | null>;
}
