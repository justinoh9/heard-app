import { useCallback, useEffect, useState } from 'react';

import type { SearchResultKind } from '@/music';

import { SupabaseCommentsBackend } from './supabase-backend';
import { CommentsError, type Comment, type NewCommentInput } from './types';

const backend = new SupabaseCommentsBackend();

/** One-off post without subscribing to an item's comment list (e.g. the rate flow's review step). */
export function postComment(input: NewCommentInput): Promise<Comment> {
  return backend.add(input);
}

export interface CommentsState {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  addComment: (input: Omit<NewCommentInput, 'itemId' | 'itemType'>) => Promise<void>;
}

/** Loads and posts comments for one item. Refetches after a successful add. */
export function useComments(itemId: string, itemType: SearchResultKind): CommentsState {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    backend
      .listForItem(itemId, itemType)
      .then(setComments)
      .catch((e: unknown) => {
        setError(e instanceof CommentsError ? e.message : 'Could not load comments.');
      })
      .finally(() => setLoading(false));
  }, [itemId, itemType]);

  useEffect(load, [load]);

  const addComment = useCallback(
    async (input: Omit<NewCommentInput, 'itemId' | 'itemType'>) => {
      await backend.add({ ...input, itemId, itemType });
      load();
    },
    [itemId, itemType, load],
  );

  return { comments, loading, error, addComment };
}
