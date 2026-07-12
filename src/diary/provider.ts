/**
 * The active diary backend — Supabase when configured, on-device otherwise.
 * Same one-line swap as the other seams.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalDiaryBackend } from './local-backend';
import { SupabaseDiaryBackend } from './supabase-backend';
import type { DiaryBackend } from './types';

export const diaryBackend: DiaryBackend = isSupabaseConfigured()
  ? new SupabaseDiaryBackend()
  : new LocalDiaryBackend();
