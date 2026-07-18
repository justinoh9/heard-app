import { getSupabase } from '@/lib/supabase';

import { summarize } from './aggregate';
import {
  LikesError,
  type LikeSummary,
  type LikeTargetType,
  type LikeToggleResult,
  type LikesBackend,
} from './types';

interface LikeSelectRow {
  target_id: string;
  user_id: string;
}

export class SupabaseLikesBackend implements LikesBackend {
  async listForTargets(
    targetType: LikeTargetType,
    targetIds: string[],
    userId: string,
  ): Promise<Map<string, LikeSummary>> {
    if (targetIds.length === 0) return new Map();

    const { data, error } = await getSupabase()
      .from('likes')
      .select('target_id, user_id')
      .eq('target_type', targetType)
      .in('target_id', targetIds);

    if (error) throw new LikesError(error.message);
    const rows = (data as LikeSelectRow[]).map((r) => ({ targetId: r.target_id, userId: r.user_id }));
    return summarize(rows, targetIds, userId);
  }

  /**
   * Read-then-write, so two calls can interleave. Neither write is allowed to
   * *claim* a change it didn't make: the delete returns the rows it removed,
   * and a duplicate insert is caught by the unique constraint. A loser reports
   * delta 0 and the count stays honest. See LikeToggleResult.
   */
  async toggle(
    targetType: LikeTargetType,
    targetId: string,
    userId: string,
  ): Promise<LikeToggleResult> {
    const supabase = getSupabase();

    const { data: existing, error: selectError } = await supabase
      .from('likes')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('user_id', userId)
      .maybeSingle();

    if (selectError) throw new LikesError(selectError.message);

    if (existing) {
      // `.select()` makes the delete report what it removed. Without it a
      // no-op delete is indistinguishable from a real one — the bug that let
      // rapid taps drive the count negative.
      const { data, error } = await supabase
        .from('likes')
        .delete()
        .eq('id', existing.id)
        .select('id');
      if (error) throw new LikesError(error.message);
      return { likedByMe: false, delta: (data?.length ?? 0) > 0 ? -1 : 0 };
    }

    const { error } = await supabase
      .from('likes')
      .insert({ target_type: targetType, target_id: targetId, user_id: userId });
    // 23505 = the unique (target_type, target_id, user_id) index fired: a
    // concurrent call already inserted this like. The end state is the one we
    // wanted, but we did not cause it.
    if (error) {
      if (error.code === '23505') return { likedByMe: true, delta: 0 };
      throw new LikesError(error.message);
    }
    return { likedByMe: true, delta: 1 };
  }
}
