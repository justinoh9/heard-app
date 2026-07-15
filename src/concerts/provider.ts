/**
 * The active concerts backend — Supabase when configured, on-device world
 * otherwise. Same one-line swap as ratings/social providers.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { PhotonGeocoder, type VenueGeocoder } from './geocode';
import { LocalConcertsBackend } from './local-backend';
import { SupabaseConcertsBackend } from './supabase-backend';
import type { ConcertsBackend } from './types';

export const concertsBackend: ConcertsBackend = isSupabaseConfigured()
  ? new SupabaseConcertsBackend()
  : new LocalConcertsBackend();

/**
 * Venue autocomplete. Keyless and backend-free, so unlike the backend above it
 * needs no env gate — there's nothing to configure and no local fallback worth
 * having (an offline geocoder would just return nothing, which is exactly what
 * `search` already does when the request fails).
 */
export const venueGeocoder: VenueGeocoder = new PhotonGeocoder();
