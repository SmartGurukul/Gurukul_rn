import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DayOfWeek } from '../api/timetable';
import { colors, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Props {
  days: DayOfWeek[];
  selected: DayOfWeek;
  onSelect: (day: DayOfWeek) => void;
  /** Kept for callers from the previous design; the chips look the same everywhere now. */
  onViolet?: boolean;
}

/**
 * One tab per school day. A phone can't fit a readable 6-day x 8-period grid, so every timetable
 * screen shows one day at a time with its periods as rows.
 */
export function TimetableDayTabs({ days, selected, onSelect, onViolet = false }: Props) {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {days.map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            style={[styles.tab, onViolet && styles.tabOnViolet, active && (onViolet ? styles.tabActiveOnViolet : styles.tabActive)]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabText, onViolet && styles.tabTextOnViolet, active && (onViolet ? styles.tabTextActiveOnViolet : styles.tabTextActive)]}>
              {t(`timetable.days.${day}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: spacing.sm },
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    minWidth: 52,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabOnViolet: {},
  tabActiveOnViolet: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontFamily: fonts.headingMedium, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  tabTextActive: { color: colors.white },
  tabTextOnViolet: {},
  tabTextActiveOnViolet: { color: colors.white },
});
