import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tints, type TintKey } from '../theme/colors';
import { fonts } from '../theme/typography';

export interface HeroStat {
  label: string;
  /** Already formatted; null while loading, undefined when unavailable. */
  value: string | null | undefined;
  hint?: string;
  /** Colours the value (and the hint) - e.g. `colors.warning` for something that needs attention. */
  tone?: string;
  /** A small white pill under the value instead of a plain hint. */
  pill?: string;
}

interface Props {
  stats: HeroStat[];
  /** Which tint the block is. Defaults to violet. */
  tint?: TintKey;
  /** Kept for callers from the previous design; the block does not overlap anything. */
  overlap?: number;
}

/** A tinted block with up to three numbers, one column each - the first thing on a screen. */
export function HeroCard({ stats, tint = 'violet' }: Props) {
  const t = tints[tint];
  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={[styles.col, i > 0 && styles.colSpaced]}>
          <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
            {stat.label}
          </Text>
          {stat.value === null ? (
            <ActivityIndicator size="small" color={t.fg} style={styles.loading} />
          ) : (
            <Text style={[styles.value, stat.tone ? { color: stat.tone } : null]} numberOfLines={1} adjustsFontSizeToFit>
              {stat.value ?? '—'}
            </Text>
          )}
          {stat.pill ? (
            <View style={styles.pill}>
              <Text style={[styles.pillText, { color: t.fg }]} numberOfLines={1}>
                {stat.pill}
              </Text>
            </View>
          ) : stat.hint ? (
            <Text style={[styles.hint, { color: stat.tone ?? t.fg }]} numberOfLines={1}>
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
    borderRadius: radius.xxl,
    padding: spacing.lg,
    flexDirection: 'row',
  },
  col: { flex: 1, gap: 2 },
  colSpaced: { paddingLeft: spacing.md },
  label: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  value: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: colors.textPrimary },
  loading: { alignSelf: 'flex-start', marginVertical: 4 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16 },
});
