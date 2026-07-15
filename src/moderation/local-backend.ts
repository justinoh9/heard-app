/**
 * On-device moderation, for zero-config checkouts. Per-user keys (unlike the
 * device-global local social feed) because a block list is personal.
 *
 * `report` writes to storage that no one will ever read — there's no reviewer
 * in local mode. That's deliberate: the UI must behave identically in both
 * modes, and a report that silently no-ops is better than a demo build where
 * the button throws.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { socialBackend } from '@/social/provider';

import { reportKey } from './filter';
import type { AdminReport, ModerationBackend, NewReport, ReportStatus } from './types';

const blocksKey = (userId: string) => `heard.blocks.${userId}`;
const reportsKey = (userId: string) => `heard.reports.${userId}`;

async function readList(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export class LocalModerationBackend implements ModerationBackend {
  async blockedBy(userId: string): Promise<string[]> {
    return readList(blocksKey(userId));
  }

  async setBlocked(userId: string, targetId: string, blocked: boolean): Promise<void> {
    const current = await readList(blocksKey(userId));
    const next = blocked
      ? [...new Set([...current, targetId])]
      : current.filter((id) => id !== targetId);
    await AsyncStorage.setItem(blocksKey(userId), JSON.stringify(next));
  }

  async severFollows(userId: string, targetId: string): Promise<void> {
    // The local social backend has no "remove follower", so only the viewer's
    // own follow can be dropped here. Acceptable: local mode is a single-device
    // demo, and the read filters already hide the blocked user either way.
    await socialBackend.setFollowing(userId, targetId, false);
  }

  async report(input: NewReport): Promise<void> {
    const key = reportKey(input.targetType, input.targetId);
    const current = await readList(reportsKey(input.reporterId));
    if (current.includes(key)) return;
    await AsyncStorage.setItem(reportsKey(input.reporterId), JSON.stringify([...current, key]));
  }

  async reportedKeys(userId: string): Promise<string[]> {
    return readList(reportsKey(userId));
  }

  // ---- Review surface -----------------------------------------------------
  // Local mode is a single-device demo with no reviewer and no second user, so
  // there is nothing to moderate. Answering "no admins here" makes the entrance
  // simply not render, which is the honest outcome — better than a Reports screen
  // that opens onto a permanent empty state.

  async isAdmin(): Promise<boolean> {
    return false;
  }

  async listReports(_status?: ReportStatus): Promise<AdminReport[]> {
    return [];
  }

  async setReportStatus(): Promise<void> {
    // Unreachable: nothing can be listed, so nothing can be resolved.
  }

  async deleteReportedContent(): Promise<void> {
    // Same.
  }
}
