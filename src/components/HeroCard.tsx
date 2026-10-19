import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, heroShadow, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';

export interface HeroStat {
  label: string;
  /** Already formatted; null while loading, undefined when unavailable. */
  value: string | null | undefined;
  hint?: string;
  /** Colours the value (and the hint) - e.g. `colors.warning` for something that needs attention. */
  tone?: string;
  /** A small marigold pill under the value instead of a plain hint. */
  pill?: string;
}

interface Props {
  stats: HeroStat[];
  /** How far the card overlaps the header above it (match `ScreenHeader`'s `overlap`). */
  overlap?: number;
}

/** The white card that overlaps a violet header: up to three numbers, one column each. */
export function HeroCard({ stats, overlap = 0 }: Props) {
  return (
    <View style={[styles.card, { marginTop: -overlap }]}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={[styles.col, i > 0 && styles.colDivided]}>
          <Text style={styles.label} numberOfLines={1}>
            {stat.label}
          </Text>
          {stat.value === null ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loading} />
          ) : (
            <Text style={[styles.value, stat.tone ? { color: stat.tone } : null]} numberOfLines={1} adjustsFontSizeToFit>
              {stat.value ?? '—'}
            </Text>
          )}
          {stat.pill ? (
            <View style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {stat.pill}
              </Text>
            </View>
          ) : stat.hint ? (
            <Text style={[styles.hint, stat.tone ? { color: stat.tone } : null]} numberOfLines={1}>
              {stat.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    ...heroShadow,
  },
  col: { flex: 1, gap: 2 },
  colDivided: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.md, marginLeft: spacing.sm },
  label: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  value: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: colors.textPrimary },
  loading: { alignSelf: 'flex-start', marginVertical: 4 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warningLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16, color: colors.warning },
});
