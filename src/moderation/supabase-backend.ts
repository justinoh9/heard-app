/**
 * Supabase-backed moderation (0019_moderation.sql). Blocks and reports are the
 * app's only private-read tables — RLS scopes every select to the caller, so
 * these queries deliberately don't filter by user id themselves in a way the
 * policy doesn't already enforce.
 */

import { getSupabase } from '@/lib/supabase';

import { fromAdminReportRow, type AdminReportRow } from './admin-rows';
import { reportKey } from './filter';
import {
  ModerationError,
  type AdminReport,
  type ModerationBackend,
  type NewReport,
  type ReportStatus,
  type ReportTargetType,
} from './types';

interface BlockRow {
  blocker_id: string;
  blocked_id: string;
}

interface ReportRow {
  target_type: string;
  target_id: string;
}

export class SupabaseModerationBackend implements ModerationBackend {
  async blockedBy(userId: string): Promise<string[]> {
    const { data, error } = await getSupabase()
      .from('blocks')
      .select('blocker_id, blocked_id')
      .eq('blocker_id', userId);
    if (error) throw new ModerationError(error.message);
    return (data as BlockRow[]).map((r) => r.blocked_id);
  }

  async setBlocked(userId: string, targetId: string, blocked: boolean): Promise<void> {
    const supabase = getSupabase();
    if (blocked) {
      const { error } = await supabase
        .from('blocks')
        .upsert({ blocker_id: userId, blocked_id: targetId }, { ignoreDuplicates: true });
      if (error) throw new ModerationError(error.message);
    } else {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', targetId);
      if (error) throw new ModerationError(error.message);
    }
  }

  async severFollows(userId: string, targetId: string): Promise<void> {
    const supabase = getSupabase();
    // Two statements rather than one `.or()`: each direction is authorized by a
    // different policy (unfollow-as-self vs. remove-own-follower), and a single
    // combined predicate would silently drop the half RLS refuses.
    const outgoing = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', userId)
      .eq('followee_id', targetId);
    if (outgoing.error) throw new ModerationError(outgoing.error.message);

    const incoming = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', targetId)
      .eq('followee_id', userId);
    if (incoming.error) throw new ModerationError(incoming.error.message);
  }

  async report(input: NewReport): Promise<void> {
    const { error } = await getSupabase()
      .from('reports')
      .upsert(
        {
          reporter_id: input.reporterId,
          target_type: input.targetType,
          target_id: input.targetId,
          target_user_id: input.targetUserId ?? null,
          reason: input.reason,
          note: input.note ?? null,
        },
        // Re-reporting the same thing is a no-op, not an error — the unique
        // constraint is the point, and `onConflict` keeps the first report's
        // reason rather than letting a later one overwrite triage state.
        { onConflict: 'reporter_id,target_type,target_id', ignoreDuplicates: true },
      );
    if (error) throw new ModerationError(error.message);
  }

  async reportedKeys(userId: string): Promise<string[]> {
    const { data, error } = await getSupabase()
      .from('reports')
      .select('target_type, target_id')
      .eq('reporter_id', userId);
    if (error) throw new ModerationError(error.message);
    return (data as ReportRow[]).map((r) => reportKey(r.target_type, r.target_id));
  }

  // ---- Review surface (0023) ----------------------------------------------

  async isAdmin(): Promise<boolean> {
    // The RPC answers only about the caller (it reads auth.uid() itself and takes
    // no argument), so there's nothing to pass and nothing to spoof.
    const { data, error } = await getSupabase().rpc('is_admin');
    if (error) {
      // A project that hasn't run 0023 yet has no such function. That's "not an
      // admin, because admins don't exist here" — not an error worth surfacing
      // in a UI that would otherwise work fine.
      return false;
    }
    return data === true;
  }

  async listReports(status?: ReportStatus): Promise<AdminReport[]> {
    let query = getSupabase().from('reports').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new ModerationError(error.message);
    // A non-admin doesn't get an error here — RLS just returns their own rows (or
    // none). The empty list IS the enforcement; there's no client-side check to
    // forget, and no way to see someone else's reports by editing this file.
    return (data as AdminReportRow[]).map(fromAdminReportRow);
  }

  async setReportStatus(id: string, status: ReportStatus): Promise<void> {
    // Only `status` is sent: 0023 revokes UPDATE on the table and grants it back
    // for that one column, so adding fields here would start failing rather than
    // silently letting a reviewer edit the evidence. reviewed_by/reviewed_at are
    // stamped by a trigger from the JWT.
    // A zero-row update is not an error to PostgREST — and the column grant
    // (0023) means only a *forbidden column* raises. Ask what changed.
    const { data, error } = await getSupabase()
      .from('reports')
      .update({ status })
      .eq('id', id)
      .select('id');
    if (error) throw new ModerationError(error.message);
    if (!data?.length) throw new ModerationError('That report could not be updated.');
  }

  async deleteReportedContent(targetType: ReportTargetType, targetId: string): Promise<void> {
    const table = targetType === 'comment' ? 'comments' : targetType === 'feed_event' ? 'feed_events' : null;
    if (!table) {
      throw new ModerationError(`${targetType} content can't be removed from here.`);
    }
    // Without `.select()` an RLS refusal looks identical to a successful
    // delete, so the triage screen would close the reports and leave the
    // reported content live — the worst possible direction for this to fail.
    const { data, error } = await getSupabase()
      .from(table)
      .delete()
      .eq('id', targetId)
      .select('id');
    if (error) throw new ModerationError(error.message);
    if (!data?.length) throw new ModerationError('That content could not be removed.');
  }
}
