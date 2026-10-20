import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from '../components/LanguageSwitch';
import { VioletHero } from '../components/VioletHero';
import { colors, radius, softShadow, spacing } from '../theme/colors';

interface Props {
  message: string;
  onDone: () => void;
}

export default function RegistrationSubmittedScreen({ message, onDone }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <VioletHero style={styles.hero}>
        <View style={[styles.languageSwitchWrapper, { top: insets.top + spacing.sm }]}>
          <LanguageSwitch />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
        <Text style={styles.title}>{t('registration.submitted.title')}</Text>
      </VioletHero>

      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.hint}>{t('registration.submitted.hint')}</Text>
        <Pressable style={styles.submit} onPress={onDone}>
          <Text style={styles.submitText}>{t('registration.submitted.backToSignIn')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  languageSwitchWrapper: {
    position: 'absolute',
    right: spacing.lg,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeText: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  body: { padding: spacing.lg, paddingTop: spacing.xl, alignItems: 'center' },
  message: { fontSize: 15, color: colors.textPrimary, textAlign: 'center', fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, lineHeight: 19 },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...softShadow,
  },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
