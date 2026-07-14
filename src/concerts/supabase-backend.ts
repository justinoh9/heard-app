/**
 * Supabase-backed concerts (0006 + 0017). Reads use `select *` so a project
 * that hasn't yet applied 0017 (no status column) still loads — the row
 * mappers default missing status to attended/confirmed. Writes that need the
 * new columns (wishlist, confirm) require 0017.
 */

import { getSupabase } from '@/lib/supabase';

import {
  fromConcertRow,
  sortConcerts,
  tagFromRow,
  toConcertRow,
  type ConcertRow,
  type TagRow,
} from './rows';
import { ConcertsError, type Concert, type ConcertsBackend, type ConcertTag, type NewConcert } from './types';

export class SupabaseConcertsBackend implements ConcertsBackend {
  async listFor(userId: string): Promise<Concert[]> {
    const supabase = getSupabase();

    // Shows the user was tagged at (ids), then one fetch for logged + tagged.
    const { data: tagRows, error: tagError } = await supabase
      .from('concert_tags')
      .select('*')
      .eq('user_id', userId);
    if (tagError) throw new ConcertsError(tagError.message);
    const taggedIds = (tagRows as TagRow[]).map((t) => t.concert_id);

    const { data: rows, error } = await supabase
      .from('concerts')
      .select('*')
      .or(
        taggedIds.length > 0
          ? `user_id.eq.${userId},id.in.(${taggedIds.join(',')})`
          : `user_id.eq.${userId}`,
      );
    if (error) throw new ConcertsError(error.message);
    const concerts = rows as ConcertRow[];
    if (concerts.length === 0) return [];

    const { data: allTags, error: allTagsError } = await supabase
      .from('concert_tags')
      .select('*')
      .in('concert_id', concerts.map((c) => c.id));
    if (allTagsError) throw new ConcertsError(allTagsError.message);
    const tagsByConcert = new Map<string, ConcertTag[]>();
    for (const t of allTags as TagRow[]) {
      tagsByConcert.set(t.concert_id, [...(tagsByConcert.get(t.concert_id) ?? []), tagFromRow(t)]);
    }

    return sortConcerts(concerts.map((c) => fromConcertRow(c, tagsByConcert.get(c.id) ?? [])));
  }

  async add(concert: NewConcert): Promise<Concert> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('concerts')
      .insert(toConcertRow(concert))
      .select('*')
      .single();
    if (error) throw new ConcertsError(error.message);
    const row = data as ConcertRow;

    if (concert.taggedUserIds.length > 0) {
      // Omit status so new tags take the DB default ('pending' post-0017,
      // absent-and-immediately-applied pre-0017).
      const { error: tagError } = await supabase
        .from('concert_tags')
        .insert(concert.taggedUserIds.map((uid) => ({ concert_id: row.id, user_id: uid })));
      if (tagError) throw new ConcertsError(tagError.message);
    }
    return fromConcertRow(
      row,
      concert.taggedUserIds.map((userId) => ({ userId, status: 'pending' })),
    );
  }

  async markAttended(concertId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('concerts')
      .update({ status: 'attended' })
      .eq('id', concertId);
    if (error) throw new ConcertsError(error.message);
  }

  async remove(concertId: string): Promise<void> {
    const { error } = await getSupabase().from('concerts').delete().eq('id', concertId);
    if (error) throw new ConcertsError(error.message);
  }

  async confirmTag(concertId: string, userId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('concert_tags')
      .update({ status: 'confirmed' })
      .eq('concert_id', concertId)
      .eq('user_id', userId);
    if (error) throw new ConcertsError(error.message);
  }

  async declineTag(concertId: string, userId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('concert_tags')
      .delete()
      .eq('concert_id', concertId)
      .eq('user_id', userId);
    if (error) throw new ConcertsError(error.message);
  }
}
