/**
 * Debounced album search. Waits for the user to stop typing, then queries the
 * active catalog, cancelling any in-flight request when the query changes
 * (MusicBrainz is rate-limited, so we don't fire a request per keystroke).
 */

import { useEffect, useState } from 'react';

import { musicCatalog } from './provider';
import { MusicCatalogError, type AlbumSearchResult } from './types';

export interface AlbumSearchState {
  results: AlbumSearchResult[];
  loading: boolean;
  error: string | null;
}

export function useAlbumSearch(query: string, debounceMs = 350): AlbumSearchState {
  const [state, setState] = useState<AlbumSearchState>({
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
      musicCatalog
        .searchAlbums(q, { signal: controller.signal, limit: 25 })
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
  }, [query, debounceMs]);

  return state;
}
