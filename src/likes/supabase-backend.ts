import { getSupabase } from '@/lib/supabase';

import { summarize } from './aggregate';
import { LikesError, type LikeSummary, type LikeTargetType, type LikesBackend } from './types';

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

  async toggle(targetType: LikeTargetType, targetId: string, userId: string): Promise<boolean> {
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
      const { error } = await supabase.from('likes').delete().eq('id', existing.id);
      if (error) throw new LikesError(error.message);
      return false;
    }

    const { error } = await supabase
      .from('likes')
      .insert({ target_type: targetType, target_id: targetId, user_id: userId });
    if (error) throw new LikesError(error.message);
    return true;
  }
}
