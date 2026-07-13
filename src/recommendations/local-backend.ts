/**
 * Local (zero-config) friend lists. Reads each followed user's ratings snapshot
 * straight from AsyncStorage (`heard.ratings.<userId>`) — the same store the
 * local ratings backend writes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RatingsSnapshot } from '@/data/ratings-backend';

import type { FriendRatingList, RecommendationsBackend } from './types';

export class LocalRecommendationsBackend implements RecommendationsBackend {
  async friendLists(userIds: string[]): Promise<FriendRatingList[]> {
    if (userIds.length === 0) return [];
    const entries = await AsyncStorage.multiGet(userIds.map((id) => `heard.ratings.${id}`));
    const lists: FriendRatingList[] = [];
    entries.forEach(([, raw], i) => {
      if (!raw) return;
      try {
        const snapshot = JSON.parse(raw) as RatingsSnapshot;
        lists.push({ userId: userIds[i], ratings: snapshot.list });
      } catch {
        // Skip a corrupt snapshot rather than failing the whole batch.
      }
    });
    return lists;
  }
}
