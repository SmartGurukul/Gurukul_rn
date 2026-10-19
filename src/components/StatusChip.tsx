import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';

type ChipVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

interface StatusChipProps {
  label: string;
  variant?: ChipVariant;
}

/** Tinted pill: green / marigold / red for status, grey for neutral, violet for "info" (a change). */
const variantStyles: Record<ChipVariant, { bg: string; text: string }> = {
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  error: { bg: colors.errorLight, text: colors.error },
  neutral: { bg: colors.surfaceMuted, text: colors.textSecondary },
  info: { bg: colors.primaryLight, text: colors.primary },
};

export function StatusChip({ label, variant = 'neutral' }: StatusChipProps) {
  const style = variantStyles[variant];

  return (
    <View style={[styles.chip, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  text: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
});
