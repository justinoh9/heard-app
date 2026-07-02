/**
 * Supabase-backed concerts (0006_concerts.sql). Same trust-client posture as
 * the rest of the prototype until Supabase Auth lands (blueprint §3.4).
 */

import { getSupabase } from '@/lib/supabase';

import { fromConcertRow, sortConcerts, toConcertRow, type ConcertRow } from './rows';
import { ConcertsError, type Concert, type ConcertsBackend, type NewConcert } from './types';

interface TagRow {
  concert_id: string;
  user_id: string;
}

export class SupabaseConcertsBackend implements ConcertsBackend {
  async listFor(userId: string): Promise<Concert[]> {
    const supabase = getSupabase();

    // Shows the user was tagged at (ids), then one fetch for logged + tagged.
    const { data: tagRows, error: tagError } = await supabase
      .from('concert_tags')
      .select('concert_id, user_id')
      .eq('user_id', userId);
    if (tagError) throw new ConcertsError(tagError.message);
    const taggedIds = (tagRows as TagRow[]).map((t) => t.concert_id);

    const { data: rows, error } = await supabase
      .from('concerts')
      .select('id, user_id, artist_name, artist_id, venue, city, show_date, score, notes, created_at')
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
      .select('concert_id, user_id')
      .in('concert_id', concerts.map((c) => c.id));
    if (allTagsError) throw new ConcertsError(allTagsError.message);
    const tagsByConcert = new Map<string, string[]>();
    for (const t of allTags as TagRow[]) {
      tagsByConcert.set(t.concert_id, [...(tagsByConcert.get(t.concert_id) ?? []), t.user_id]);
    }

    return sortConcerts(
      concerts.map((c) => fromConcertRow(c, tagsByConcert.get(c.id) ?? [])),
    );
  }

  async add(concert: NewConcert): Promise<Concert> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('concerts')
      .insert(toConcertRow(concert))
      .select('id, user_id, artist_name, artist_id, venue, city, show_date, score, notes, created_at')
      .single();
    if (error) throw new ConcertsError(error.message);
    const row = data as ConcertRow;

    if (concert.taggedUserIds.length > 0) {
      const { error: tagError } = await supabase
        .from('concert_tags')
        .insert(concert.taggedUserIds.map((uid) => ({ concert_id: row.id, user_id: uid })));
      if (tagError) throw new ConcertsError(tagError.message);
    }
    return fromConcertRow(row, concert.taggedUserIds);
  }
}
