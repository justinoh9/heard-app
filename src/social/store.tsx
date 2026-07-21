/**
 * Social context: the people directory, who the viewer follows, and the
 * activity feed (self + followees). Publishing is fire-and-forget with an
 * optimistic prepend, same posture as ratings commits.
 *
 * Mounted above the ratings and feed bridges in _layout.tsx because both call
 * `publish` — the blueprint invariant is that every log path emits a feed
 * event (§1.3).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { analyticsBackend } from '@/analytics/provider';
import { useAuth } from '@/auth/store';
import { hideBlockedEvents, hideBlockedProfiles } from '@/moderation/filter';
import { useModeration } from '@/moderation/store';

import { sortEvents } from './feed-rows';
import { socialBackend } from './provider';
import type {
  Profile,
  ProfilePage,
  ProfilePatch,
  ProfileSearch,
  SocialEvent,
  SocialEventPayload,
  SocialEventType,
} from './types';

export interface SocialApi {
  /** Everyone else in the directory (the viewer is filtered out). */
  people: Profile[];
  /**
   * One searched, paginated page of the directory — the read that has to survive
   * real user counts, and the only one the People screen should use.
   */
  searchPeople: (search?: ProfileSearch) => Promise<ProfilePage>;
  followingIds: Set<string>;
  /** Recent events by the viewer + followees, newest first. */
  feed: SocialEvent[];
  feedLoading: boolean;
  /** True while an older page is still available to fetch. */
  feedHasMore: boolean;
  /** True while a loadMoreFeed() page is in flight. */
  feedLoadingMore: boolean;
  /** Fetch the next older page of feed events and append it. */
  loadMoreFeed: () => void;
  /** The viewer's chosen Top 4 item ids (empty until picked). */
  myFavorites: string[];
  /** The viewer's own directory row (handle/bio/avatar), null until loaded. */
  myProfile: Profile | null;
  toggleFollow: (userId: string) => void;
  /** Replace the viewer's Top 4 (optimistic; at most 4 ids). */
  saveFavorites: (itemIds: string[]) => void;
  /** Update the viewer's identity fields; rejects with HandleTakenError. */
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  /** Append an event to the log (stamped with the signed-in user). */
  publish: (type: SocialEventType, payload: SocialEventPayload) => void;
  refresh: () => void;
}

export const SocialContext = createContext<SocialApi | null>(null);

/** Feed page size — refresh loads one page; loadMoreFeed appends the next. */
const FEED_PAGE_SIZE = 25;

export function useSocialState(): SocialApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const displayName = user?.displayName ?? '';
  // Blocking is applied here rather than in the screens: every consumer of
  // `people`/`feed` gets it for free, so a new surface can't forget.
  const { blockedIds } = useModeration();
  const [people, setPeople] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<SocialEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [myFavorites, setMyFavorites] = useState<string[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  /**
   * Generation counter for `refresh`. Every toggleFollow triggers a refresh, and
   * refresh awaits `feedFor` in the middle, so two of them routinely finish out
   * of order — follow-then-unfollow could land the *first* reload last and put
   * the follow back, untouched. The same staleness leaks across accounts:
   * `useSocialState` lives in the root layout and never unmounts, so a refresh
   * issued as one user could resolve into the next user's session and render
   * their feed, Top 4, and profile. Changing `userId` re-runs the mount effect,
   * which bumps this, so both cases collapse to "only the newest may write".
   */
  const refreshSeq = useRef(0);
  /** Follow toggles awaiting their write, keyed by target — one tap, one write. */
  const followInFlight = useRef(new Set<string>());

  const refresh = useCallback(() => {
    const seq = ++refreshSeq.current;
    const current = () => seq === refreshSeq.current;
    setFeedLoading(true);
    // The people directory is public, so it loads for guests too; the follow
    // graph and personalized feed need a viewer, so they stay empty signed-out.
    Promise.all([
      socialBackend.listProfiles(),
      userId ? socialBackend.following(userId) : Promise.resolve([] as string[]),
    ])
      .then(async ([profiles, ids]) => {
        if (!current()) return;
        setFollowingIds(new Set(ids));
        setPeople(profiles.filter((p) => p.userId !== userId));
        const own = userId ? profiles.find((p) => p.userId === userId) ?? null : null;
        setMyProfile(own);
        setMyFavorites(own?.favorites ?? []);
        const page = userId ? await socialBackend.feedFor([userId, ...ids], FEED_PAGE_SIZE) : [];
        if (!current()) return; // re-checked: the await above is the slow part
        setFeed(page);
        // A full page implies there may be older events to page into.
        setFeedHasMore(page.length === FEED_PAGE_SIZE);
      })
      .catch((e: unknown) => console.warn('[social] refresh failed:', e))
      .finally(() => {
        if (current()) setFeedLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    // Signed in: join the directory (idempotent) before loading. Guest: just
    // load the public directory so people/profiles are browsable without an account.
    if (userId) {
      socialBackend
        .upsertProfile({ userId, displayName })
        .catch((e: unknown) => console.warn('[social] profile upsert failed:', e))
        .finally(refresh);
    } else {
      refresh();
    }
  }, [userId, displayName, refresh]);

  return useMemo<SocialApi>(
    () => ({
      // `hideBlockedEvents` also drops reposts *of* a blocked user, so blocking
      // someone doesn't leave them visible second-hand through a friend.
      people: hideBlockedProfiles(people, blockedIds),
      /**
       * Paginated directory search. It lives on the store rather than letting the
       * screen call the backend because of the invariant in CLAUDE.md: blocked
       * users are filtered in the stores, never in the screens. A screen that
       * queried `socialBackend.searchProfiles` itself would look perfectly
       * reasonable and quietly show people you blocked.
       */
      searchPeople: async (search) => {
        const page = await socialBackend.searchProfiles(search);
        return { ...page, profiles: hideBlockedProfiles(page.profiles, blockedIds) };
      },
      followingIds,
      feed: hideBlockedEvents(feed, blockedIds),
      feedLoading,
      feedHasMore,
      feedLoadingMore,
      myFavorites,
      myProfile,
      refresh,
      loadMoreFeed: () => {
        if (!userId || feedLoadingMore || !feedHasMore || feed.length === 0) return;
        const before = feed[feed.length - 1].createdAt;
        setFeedLoadingMore(true);
        socialBackend
          .feedFor([userId, ...followingIds], FEED_PAGE_SIZE, before)
          .then((older) => {
            setFeed((prev) => [...prev, ...older]);
            setFeedHasMore(older.length === FEED_PAGE_SIZE);
          })
          .catch((e: unknown) => console.warn('[social] loadMoreFeed failed:', e))
          .finally(() => setFeedLoadingMore(false));
      },
      saveFavorites: (itemIds) => {
        if (!userId) return;
        const capped = itemIds.slice(0, 4);
        const previous = myFavorites;
        setMyFavorites(capped);
        socialBackend.setFavorites(userId, capped).catch((e: unknown) => {
          console.warn('[social] saving favorites failed:', e);
          setMyFavorites(previous);
        });
      },
      updateProfile: async (patch) => {
        if (!userId) return;
        const previous = myProfile;
        // Optimistic: reflect the edit immediately, roll back if the write fails
        // (e.g. handle taken). Empty strings clear the field (stored as null).
        const clean = (v?: string | null) => (v == null || v === '' ? undefined : v);
        setMyProfile((p) =>
          p
            ? {
                ...p,
                handle: patch.handle !== undefined ? clean(patch.handle) : p.handle,
                bio: patch.bio !== undefined ? clean(patch.bio) : p.bio,
                avatarUrl: patch.avatarUrl !== undefined ? clean(patch.avatarUrl) : p.avatarUrl,
              }
            : p,
        );
        try {
          await socialBackend.updateProfile(userId, patch);
        } catch (e) {
          setMyProfile(previous);
          throw e;
        }
      },
      toggleFollow: (targetId) => {
        if (!userId || targetId === userId) return;
        // No Follow button carries `disabled`, and follow/unfollow is a
        // read-then-write pair — without this, tapping Follow then Unfollow
        // fires both writes concurrently and whichever reload lands last wins.
        if (followInFlight.current.has(targetId)) return;
        followInFlight.current.add(targetId);
        const willFollow = !followingIds.has(targetId);
        // Optimistic: flip the set now, reconcile the feed after the write.
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (willFollow) next.add(targetId);
          else next.delete(targetId);
          return next;
        });
        socialBackend
          .setFollowing(userId, targetId, willFollow)
          .then(() => {
            // Only the follow direction is a funnel step — unfollowing isn't the
            // opposite of connecting, it's just a Tuesday. Tracked after the write
            // lands so a failed follow doesn't count as one.
            if (willFollow) void analyticsBackend.track(userId, 'followed');
            refresh();
          })
          .catch((e: unknown) => {
            console.warn('[social] follow toggle failed:', e);
            setFollowingIds((prev) => {
              const next = new Set(prev);
              if (willFollow) next.delete(targetId);
              else next.add(targetId);
              return next;
            });
          })
          .finally(() => followInFlight.current.delete(targetId));
      },
      publish: (type, payload) => {
        if (!userId) return;
        socialBackend
          .publishEvent({ userId, displayName, type, payload })
          .then((stored) => setFeed((prev) => sortEvents([stored, ...prev])))
          .catch((e: unknown) => console.warn('[social] publish failed:', e));
      },
    }),
    [
      people,
      followingIds,
      feed,
      feedLoading,
      feedHasMore,
      feedLoadingMore,
      myFavorites,
      myProfile,
      refresh,
      userId,
      displayName,
      blockedIds,
    ],
  );
}

export function useSocial(): SocialApi {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialContext.Provider');
  return ctx;
}
