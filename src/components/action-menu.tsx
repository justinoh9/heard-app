/**
 * A bottom action sheet: a backdrop plus a card of choices.
 *
 * Exists because this app deliberately never uses React Native's `Alert` — it's
 * unreliable on react-native-web, which is the deploy that matters. Used for
 * the moderation actions (block / report) and their confirmations, where a
 * mis-tap has consequences and a plain button wouldn't be enough.
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export interface MenuAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Renders in the danger colour — blocking, reporting, deleting. */
  destructive?: boolean;
  onPress: () => void;
}

export function ActionMenu({
  visible,
  title,
  message,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  actions: MenuAction[];
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android's hardware back must dismiss, not fall through to the route.
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss menu">
        {/* Swallow presses on the card so tapping an action doesn't also
            trigger the backdrop's dismiss underneath it. */}
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          onPress={() => {}}>
          {title ? (
            <ThemedText type="smallBold" style={styles.title}>
              {title}
            </ThemedText>
          ) : null}
          {message ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
              {message}
            </ThemedText>
          ) : null}

          {actions.map((a) => (
            <Pressable
              key={a.label}
              testID={`action-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
              onPress={a.onPress}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: theme.background, opacity: pressed ? 0.6 : 1 },
              ]}>
              {a.icon ? (
                <Ionicons
                  name={a.icon}
                  size={18}
                  color={a.destructive ? theme.danger : theme.text}
                />
              ) : null}
              <ThemedText
                type="smallBold"
                style={a.destructive ? { color: theme.danger } : undefined}>
                {a.label}
              </ThemedText>
            </Pressable>
          ))}

          <Pressable
            testID="action-cancel"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', marginBottom: Spacing.two },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
  cancel: { alignItems: 'center', paddingVertical: Spacing.three },
});
