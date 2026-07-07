/**
 * Deezer JSON request transport. Kept separate from deezer.ts (and never
 * imported by test-reachable modules) because it touches `document` and
 * react-native's Platform — wired only in provider.ts.
 *
 * Deezer's JSON API blocks browser CORS (it sends no Access-Control-Allow-Origin
 * even when an Origin is present), so on WEB we can't `fetch` it — we use JSONP:
 * a <script> tag whose `src` includes `&output=jsonp&callback=…`, which Deezer
 * answers by invoking that global callback with the payload. NATIVE has no CORS
 * wall, so it just fetches. Either way the returned picture URL is a plain CDN
 * image that renders fine (images aren't CORS-gated).
 */

import { Platform } from 'react-native';

import type { DeezerSearchResponse } from './deezer';
import type { SearchOptions } from './types';

/** JSONP can't be aborted mid-flight, so bound it with a timeout instead. */
const JSONP_TIMEOUT_MS = 5000;

let callbackCounter = 0;

function requestViaFetch(url: string, opts?: SearchOptions): Promise<DeezerSearchResponse> {
  return fetch(url, { signal: opts?.signal, headers: { Accept: 'application/json' } }).then(
    (r) => r.json() as Promise<DeezerSearchResponse>,
  );
}

function requestViaJsonp(url: string): Promise<DeezerSearchResponse> {
  return new Promise((resolve, reject) => {
    const name = `__deezerJsonp${callbackCounter++}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[name];
      script.remove();
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('Deezer request timed out'))), JSONP_TIMEOUT_MS);

    (window as unknown as Record<string, unknown>)[name] = (data: DeezerSearchResponse) =>
      finish(() => resolve(data));
    script.onerror = () => finish(() => reject(new Error('Deezer request failed')));
    script.src = `${url}&output=jsonp&callback=${name}`;
    document.head.appendChild(script);
  });
}

export function deezerRequest(url: string, opts?: SearchOptions): Promise<DeezerSearchResponse> {
  return Platform.OS === 'web' ? requestViaJsonp(url) : requestViaFetch(url, opts);
}
