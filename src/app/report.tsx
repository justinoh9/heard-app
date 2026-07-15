import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import { ModalDialogFrame } from '@/components/modal-dialog-frame';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useModeration } from '@/moderation/store';
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from '@/moderation/types';

/**
 * Report a person or a piece of content (ROADMAP Phase 4). Reached from the
 * overflow menu on a profile or a comment.
 *
 * Reports are write-only from the client: they land in a private table that
 * only a reviewer with the service role can read (`0019_moderation.sql`).
 * Filing one is deliberately low-friction — a reason is required, the note
 * isn't — because a reporting flow people abandon is a safety feature that
 * doesn't work.
 */
export default function ReportModal() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const toast = useToast();
  const { report, hasReported } = useModeration();
  useAuthGate(); // reporting needs an account — bounce guests to sign-in

  const params = useLocalSearchParams<{
    targetType?: string;
    targetId?: string;
    targetUserId?: string;
    name?: string;
  }>();
  const targetType = (params.targetType ?? 'user') as ReportTargetType;
  const targetId = String(params.targetId ?? '');
  const name = params.name || 'this user';

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const already = targetId ? hasReported(targetType, targetId) : false;
  const what = targetType === 'user' ? name : `this ${targetType}`;

  async function submit() {
    if (!reason || !targetId || saving) return;
    setSaving(true);
    try {
      await report({
        targetType,
        targetId,
        targetUserId: params.targetUserId ? String(params.targetUserId) : undefined,
        reason,
        note: note.trim() || undefined,
      });
      haptics.success();
      toast('Report sent. Thanks for flagging it.', '🛡️');
      router.back();
    } catch (e: unknown) {
      console.warn('[report] failed:', e);
      toast('Could not send that report. Try again.', '⚠️');
      setSaving(false);
    }
  }

  return (
    <ModalDialogFrame>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Report</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {already ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={40} color={theme.accent} />
            <ThemedText type="smallBold">You've already reported this</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              We're looking at it. You can also block {name} so you stop seeing them entirely.
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Tell us what's wrong with {what}. Reports are private — {name} won't be told who
              reported them.
            </ThemedText>

            <ThemedText type="smallBold" themeColor="textSecondary">
              WHAT'S THE PROBLEM?
            </ThemedText>
            <View style={styles.reasons}>
              {REPORT_REASONS.map((r) => {
                const on = reason === r.key;
                return (
                  <Pressable
                    key={r.key}
                    testID={`reason-${r.key}`}
                    onPress={() => setReason(r.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.reason,
                      {
                        backgroundColor: on ? theme.accent : theme.backgroundElement,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: on ? theme.onAccent : theme.text }}>
                      {r.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <TextField
              testID="report-note"
              label="Anything else? (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Add context for whoever reviews this"
              multiline
              maxLength={1000}
            />

            <Pressable
              testID="report-submit"
              onPress={submit}
              disabled={!reason || saving}
              style={({ pressed }) => [
                styles.primary,
                {
                  backgroundColor: theme.danger,
                  opacity: !reason || saving ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                {saving ? 'Sending…' : 'Send report'}
              </ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ModalDialogFrame>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  body: { gap: Spacing.three, padding: Spacing.four },
  reasons: { gap: Spacing.two },
  reason: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.three, borderRadius: 12 },
  primary: { paddingVertical: Spacing.three, borderRadius: 12, alignItems: 'center' },
  done: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  center: { textAlign: 'center' },
});
