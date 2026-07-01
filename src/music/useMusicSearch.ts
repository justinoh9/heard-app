/**
 * Debounced music search. Waits for the user to stop typing, then queries the
 * active catalog, cancelling any in-flight request when the query changes — so
 * we don't fire a request (and burn Spotify rate limit) per keystroke.
 */

import { useEffect, useState } from 'react';

import { musicCatalog } from './provider';
import { MusicCatalogError, type SearchResult } from './types';

export type MusicSearchKind = 'album' | 'song' | 'albumArtist' | 'all';

export interface MusicSearchState {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
}

function searchFor(kind: MusicSearchKind) {
  if (kind === 'album') return musicCatalog.searchAlbums.bind(musicCatalog);
  if (kind === 'song') return musicCatalog.searchTracks.bind(musicCatalog);
  if (kind === 'albumArtist') return musicCatalog.searchAlbumsAndArtists.bind(musicCatalog);
  return musicCatalog.searchAll.bind(musicCatalog);
}

export function useMusicSearch(
  query: string,
  kind: MusicSearchKind = 'album',
  debounceMs = 350,
): MusicSearchState {
  const [state, setState] = useState<MusicSearchState>({
    results: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ results: [], loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchFor(kind)(q, { signal: controller.signal })
        .then((results) => setState({ results, loading: false, error: null }))
        .catch((e: unknown) => {
          if ((e as Error)?.name === 'AbortError') return; // superseded by a newer query
          setState({
            results: [],
            loading: false,
            error: e instanceof MusicCatalogError ? e.message : 'Search failed. Try again.',
          });
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind, debounceMs]);

  return state;
}
