import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { requestPushPermission, usePushStatus } from '../push/pushStatus';
import { colors, radius, spacing } from '../theme/colors';

const DISMISSED_AT_KEY = 'gurukul.pushPromptDismissedAt';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sits at the top of the home screen. Before the first system prompt it explains what
 * notifications are for and then asks (an explained first prompt gets allowed far more often than
 * a cold one); once notifications are off it says so, with a way to turn them back on. Dismissing
 * either hides it for 7 days.
 */
export function NotificationPermissionPrompt() {
  const { t } = useTranslation();
  const { permission } = usePushStatus();
  const [snoozed, setSnoozed] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_AT_KEY)
      .then((value) => setSnoozed(!!value && Date.now() - Number(value) < SNOOZE_MS))
      .catch(() => setSnoozed(false));
  }, []);

  // The web app (smartgurukul.org/app) has no push, so there's nothing to turn on.
  if (Platform.OS === 'web' || !permission || snoozed !== false || permission.status === 'granted') return null;

  const dismiss = () => {
    setSnoozed(true);
    AsyncStorage.setItem(DISMISSED_AT_KEY, String(Date.now())).catch(() => {});
  };

  const ask = async () => {
    setAsking(true);
    try {
      await requestPushPermission();
    } finally {
      setAsking(false);
    }
  };

  const undetermined = permission.status === 'undetermined';
  // Android lets an app ask again after one "Don't allow"; after that (or on iOS, after any
  // refusal) only the system Settings can turn notifications back on.
  const turnOn = undetermined || permission.canAskAgain ? ask : () => Linking.openSettings();

  return (
    <View style={[styles.card, undetermined ? styles.cardInfo : styles.cardWarning]}>
      <View style={styles.header}>
        <FontAwesome5
          name={undetermined ? 'bell' : 'bell-slash'}
          size={16}
          color={undetermined ? colors.primary : colors.warning}
        />
        <Text style={styles.title}>
          {undetermined ? t('notifications.prompt.askTitle') : t('notifications.prompt.offTitle')}
        </Text>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel={t('notifications.prompt.dismiss')}>
          <FontAwesome5 name="times" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.body}>
        {undetermined ? t('notifications.prompt.askBody') : t('notifications.prompt.offBody')}
      </Text>
      <Pressable style={styles.button} onPress={turnOn} disabled={asking}>
        <Text style={styles.buttonText}>
          {undetermined ? t('notifications.prompt.allow') : t('notifications.prompt.turnOn')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  cardInfo: { backgroundColor: colors.primaryLight, borderColor: colors.border },
  cardWarning: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
