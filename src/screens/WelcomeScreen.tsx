import { FontAwesome5 } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from '../components/LanguageSwitch';
import { Logo } from '../components/Logo';
import { colors, radius, spacing, tints } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Props {
  onFindSchool: () => void;
  onRegisterSchool: () => void;
}

/** First screen: white with two soft tinted circles, the tagline, three tinted blocks, the two ways in. */
export default function WelcomeScreen({ onFindSchool, onRegisterSchool }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const blocks = [
    { key: 'attendance', icon: 'calendar-check', label: t('welcome.blocks.attendance'), tint: tints.mint },
    { key: 'fees', icon: 'rupee-sign', label: t('welcome.blocks.fees'), tint: tints.marigold },
    { key: 'timetable', icon: 'clock', label: t('welcome.blocks.timetable'), tint: tints.sky },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.circle, styles.circleViolet]} pointerEvents="none" />
      <View style={[styles.circle, styles.circleMarigold]} pointerEvents="none" />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <Logo width={150} />
        <LanguageSwitch />
      </View>

      <View style={styles.hero}>
        <Text style={styles.headline}>{t('welcome.tagline')}</Text>
        <Text style={styles.lead}>{t('welcome.lead')}</Text>
        <View style={styles.blocks}>
          {blocks.map((block) => (
            <View key={block.key} style={[styles.block, { backgroundColor: block.tint.bg }]}>
              <View style={styles.blockIcon}>
                <FontAwesome5 name={block.icon} size={16} color={block.tint.fg} />
              </View>
              <Text style={styles.blockLabel} numberOfLines={1}>
                {block.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
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
  root: { flex: 1, backgroundColor: colors.surface, overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 999 },
  circleViolet: { right: -60, top: -40, width: 220, height: 220, backgroundColor: tints.violet.bg },
  circleMarigold: { left: -70, top: 300, width: 180, height: 180, backgroundColor: tints.marigold.bg },
  topBar: {
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hero: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  headline: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 34, lineHeight: 42 },
  lead: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  blocks: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  block: { flex: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  blockIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  blockLabel: { fontFamily: fonts.headingMedium, fontSize: 13, color: colors.textPrimary },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.onPrimary, fontFamily: fonts.headingMedium, fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  secondaryButton: {
    borderRadius: 18,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: tints.violet.bg,
  },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 15 },
  pill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { color: tints.marigold.fg, fontFamily: fonts.bodySemibold, fontSize: 12 },
  pressed: { opacity: 0.85 },
});
