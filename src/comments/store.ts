import { useCallback, useEffect, useMemo, useState } from 'react';

import { hideBlockedAuthors } from '@/moderation/filter';
import { useModeration } from '@/moderation/store';
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
  /** Delete the caller's own comment, then refetch. */
  removeComment: (id: string, userId: string) => Promise<void>;
}

/** Loads and posts comments for one item. Refetches after a successful add. */
export function useComments(itemId: string, itemType: SearchResultKind): CommentsState {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { blockedIds } = useModeration();

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

  const removeComment = useCallback(
    async (id: string, userId: string) => {
      await backend.remove(id, userId);
      load();
    },
    [load],
  );

  // Filtered here rather than in the screen, so every caller (item page,
  // threads, counts) hides blocked authors consistently. `buildThreads` runs
  // downstream of this, so a blocked user's replies go with them.
  const visible = useMemo(() => hideBlockedAuthors(comments, blockedIds), [comments, blockedIds]);

  return { comments: visible, loading, error, addComment, removeComment };
}
