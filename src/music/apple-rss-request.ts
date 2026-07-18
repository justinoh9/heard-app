/**
 * Transport for the Apple RSS new-releases feed — the impure half of
 * `apple-rss.ts`, kept separate (like deezer-request.ts) because it needs
 * Platform, which the node test runner can't load.
 *
 * Web goes through the same-origin Vercel rewrite (Apple sends no CORS
 * headers); native fetches Apple directly. On the local dev server the proxy
 * path doesn't exist — that surfaces as a failed fetch, and the caller treats
 * it like any network failure (the section just doesn't render).
 */

import { Platform } from 'react-native';

import {
  APPLE_RSS_FEED_URL,
  APPLE_RSS_PROXY_PATH,
  parseAppleRss,
  recentReleases,
  type NewRelease,
} from './apple-rss';

/** The current new releases, newest first. Throws on network/HTTP failure. */
export async function fetchNewReleases(limit = 10): Promise<NewRelease[]> {
  const url = Platform.OS === 'web' ? APPLE_RSS_PROXY_PATH : APPLE_RSS_FEED_URL;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Apple RSS feed failed (${res.status}).`);
  return recentReleases(parseAppleRss(await res.json()), new Date(), undefined, limit);
}
