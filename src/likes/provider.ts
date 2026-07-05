/**
 * The likes backend singleton. Supabase-only from day one (like comments), so
 * there's no local fallback to choose — this is just the shared instance for
 * screens that talk to the backend directly (e.g. the Activity inbox).
 */

import { SupabaseLikesBackend } from './supabase-backend';
import type { LikesBackend } from './types';

export const likesBackend: LikesBackend = new SupabaseLikesBackend();
