import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from '../components/LanguageSwitch';
import { Logo } from '../components/Logo';
import { colors, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Props {
  onFindSchool: () => void;
  onRegisterSchool: () => void;
}

/** First screen: a violet field with the tagline, and a white sheet with the two ways in. */
export default function WelcomeScreen({ onFindSchool, onRegisterSchool }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.circle, styles.circleTop]} pointerEvents="none" />
      <View style={[styles.circle, styles.circleLeft]} pointerEvents="none" />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <Logo width={150} onDarkBackground />
        <LanguageSwitch />
      </View>

      <View style={styles.hero}>
        <Text style={styles.headline}>{t('welcome.tagline')}</Text>
        <Text style={styles.lead}>{t('welcome.lead')}</Text>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.sheetTitle}>{t('welcome.subtitle')}</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={onFindSchool}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>{t('welcome.findSchool')}</Text>
        </Pressable>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('welcome.newHere')}</Text>
          <View style={styles.dividerLine} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={onRegisterSchool}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>{t('welcome.registerSchool')}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t('welcome.registerTime')}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, overflow: 'hidden' },
  circle: { position: 'absolute', backgroundColor: colors.primaryBright },
  circleTop: { right: -80, top: -60, width: 260, height: 260, borderRadius: 130 },
  circleLeft: { left: -90, top: 180, width: 220, height: 220, borderRadius: 110, opacity: 0.6 },
  topBar: {
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hero: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  headline: { color: colors.onPrimary, fontFamily: fonts.heading, fontSize: 34, lineHeight: 42 },
  lead: { color: colors.onPrimaryMuted, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.headingMedium, fontSize: 17, lineHeight: 24, color: colors.textPrimary },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.onPrimary, fontFamily: fonts.headingMedium, fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 15 },
  pill: { backgroundColor: colors.warningLight, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { color: colors.warning, fontFamily: fonts.bodySemibold, fontSize: 12 },
  pressed: { opacity: 0.85 },
});
