/**
 * Top 4 resolution (PRODUCT_BLUEPRINT §2.D): chosen favorite ids → the ranked
 * items to display. Pure so the fallback rules are unit-testable.
 */

import type { RankedItem } from '@/ranking/types';

export const TOP_FAVORITES = 4;

/**
 * Resolve chosen favorites against a ranked list, preserving the chosen
 * order and dropping ids the user no longer has rated. With nothing chosen
 * (or nothing resolvable), fall back to the top of the ranked list so the
 * showcase never renders empty.
 */
export function resolveFavorites(
  ids: string[] | undefined,
  ranked: RankedItem[],
): { items: RankedItem[]; chosen: boolean } {
  if (ids && ids.length > 0) {
    const byId = new Map(ranked.map((r) => [r.item.id, r]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((r): r is RankedItem => r !== undefined)
      .slice(0, TOP_FAVORITES);
    if (items.length > 0) return { items, chosen: true };
  }
  return { items: ranked.slice(0, TOP_FAVORITES), chosen: false };
}
