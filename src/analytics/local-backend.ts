/**
 * On-device analytics: a no-op that says so.
 *
 * Local mode is a single-device demo with one user and no reviewer, so there is
 * no funnel to measure and nowhere to send it. Writing events to AsyncStorage
 * would be worse than doing nothing: it would fill a device with data that no
 * screen reads, and `delete_own_account`'s local pattern sweep would then be
 * responsible for a key nobody remembers.
 *
 * The console line is kept because it's genuinely useful when wiring a new call
 * site — you can see the event fire without a database.
 */

import type {
  AnalyticsBackend,
  AnalyticsEventName,
  AnalyticsProps,
  FunnelCounts,
} from './types';

export class LocalAnalyticsBackend implements AnalyticsBackend {
  async track(userId: string, name: AnalyticsEventName, props?: AnalyticsProps): Promise<void> {
    if (__DEV__) console.log('[analytics:local]', name, props ?? {});
  }

  async funnel(): Promise<FunnelCounts | null> {
    return null;
  }
}
