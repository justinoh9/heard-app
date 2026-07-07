/**
 * Progressively fills artist-kind search results with a photo. iTunes returns
 * no artist artwork, so search rows start on a placeholder; this resolves each
 * artist's picture by name from the ArtistImageProvider (Deezer) and patches
 * `coverUrl` as each arrives — the list renders instantly and faces fade in a
 * beat later, rather than blocking the whole search on image lookups.
 *
 * The provider caches per name (misses included), so an artist that recurs
 * across searches is only ever fetched once. Superseded searches are ignored
 * via the `active` flag (Deezer's JSONP transport can't be aborted).
 */

import { useEffect, useMemo, useState } from 'react';

import { artistImages } from './provider';
import type { SearchResult } from './types';

export function useArtistImages(results: SearchResult[]): SearchResult[] {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    for (const r of results) {
      if (r.kind !== 'artist' || r.coverUrl) continue;
      artistImages
        .getArtistImage(r.title)
        .then((url) => {
          if (!active || !url) return;
          setImages((prev) => (prev[r.id] ? prev : { ...prev, [r.id]: url }));
        })
        .catch(() => {}); // best-effort: keep the placeholder
    }
    return () => {
      active = false;
    };
  }, [results]);

  return useMemo(
    () =>
      results.map((r) =>
        r.kind === 'artist' && !r.coverUrl && images[r.id] ? { ...r, coverUrl: images[r.id] } : r,
      ),
    [results, images],
  );
}
