/**
 * Supabase-backed analytics (0027_analytics.sql).
 *
 * `track` swallows its errors. That is not sloppiness — it is the contract in
 * types.ts. A telemetry insert failing (offline, rate limited, the migration not
 * run yet) must never surface to a user who was trying to rate an album, and must
 * never reject into a call site that didn't await it and would take the whole
 * screen down with an unhandled rejection.
 */

import { getSupabase } from '@/lib/supabase';

import type {
  AnalyticsBackend,
  AnalyticsEventName,
  AnalyticsProps,
  FunnelCounts,
} from './types';

interface FunnelRow {
  signed_up: number | string;
  activated: number | string;
  connected: number | string;
  retained_d7: number | string;
}

export class SupabaseAnalyticsBackend implements AnalyticsBackend {
  async track(userId: string, name: AnalyticsEventName, props?: AnalyticsProps): Promise<void> {
    try {
      const { error } = await getSupabase()
        .from('analytics_events')
        .insert({ user_id: userId, name, props: props ?? {} });
      if (error) console.warn('[analytics] track failed:', error.message);
    } catch (e: unknown) {
      console.warn('[analytics] track threw:', e);
    }
  }

  async funnel(days: number): Promise<FunnelCounts | null> {
    const { data, error } = await getSupabase().rpc('analytics_funnel', { p_since_days: days });
    if (error) {
      console.warn('[analytics] funnel failed:', error.message);
      return null;
    }
    // The function returns zero rows for a non-admin (its WHERE is is_admin()),
    // which is the enforcement — not an error to report.
    const row = (data as FunnelRow[])?.[0];
    if (!row) return null;
    return {
      signedUp: Number(row.signed_up),
      activated: Number(row.activated),
      connected: Number(row.connected),
      retainedD7: Number(row.retained_d7),
    };
  }
}
