/**
 * Avatar upload (ROADMAP G4). Pushes a picked image into the Supabase Storage
 * `avatars` bucket (0015_avatars.sql) and returns its public URL for the
 * profile's `avatar_url`. Supabase-only — the picker is hidden in local mode.
 *
 * Why base64 → bytes rather than uploading the Blob directly: React Native's
 * fetch-a-file-uri-into-a-Blob path is unreliable with supabase-js (it commonly
 * yields a 0-byte object). Decoding the picker's base64 into a Uint8Array is the
 * supported cross-platform path; `atob` is available on web and Hermes (RN 0.85).
 */

import { getSupabase } from '@/lib/supabase';

const BUCKET = 'avatars';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Upload the image (as base64) to `<uid>/avatar.<ext>` and return its public
 * URL. Overwrites the user's previous avatar (upsert), so each user keeps a
 * single file. A `?v=` cache-buster is appended so expo-image / the CDN don't
 * keep serving the replaced file at the (unchanged) path.
 */
export async function uploadAvatar(
  userId: string,
  base64: string,
  mimeType?: string | null,
): Promise<string> {
  const supabase = getSupabase();
  const ext = mimeType?.includes('png') ? 'png' : 'jpg';
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(base64), { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
