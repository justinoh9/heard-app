/**
 * Supabase-backed invites (0028_invites.sql). Both calls are RPCs, because both
 * do things RLS deliberately forbids the client: minting rows under a per-user
 * cap, and reading a row by a code you were handed.
 */

import { getSupabase } from '@/lib/supabase';

import { InvitesError, type Invite, type InvitesBackend } from './types';

interface InviteRow {
  code: string;
  invitee_id: string | null;
  redeemed_at: string | null;
}

export class SupabaseInvitesBackend implements InvitesBackend {
  async mine(target = 5): Promise<Invite[]> {
    const { data, error } = await getSupabase().rpc('my_invites', { p_target: target });
    if (error) throw new InvitesError(error.message);
    return ((data ?? []) as InviteRow[]).map((r) => ({
      code: r.code,
      inviteeId: r.invitee_id ?? undefined,
      redeemedAt: r.redeemed_at ?? undefined,
    }));
  }

  async redeem(code: string): Promise<string | null> {
    const { data, error } = await getSupabase().rpc('redeem_invite', { p_code: code });
    if (error) throw new InvitesError(error.message);
    // The function returns the inviter's id, or null for every flavour of "no".
    return (data as string | null) ?? null;
  }
}
