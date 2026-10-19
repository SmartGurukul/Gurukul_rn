import { FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '../theme/colors';
import { fonts } from '../theme/typography';
import { addDaysIso, formatIsoDate, pickedDate, todayIso } from '../utils/timetable';
import { parseIsoDate, toIsoDate } from './DatePickerField';

interface Props {
  /** The chosen date (YYYY-MM-DD), or null for the week. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Offer the week as well as dates. */
  showWeek?: boolean;
  /** Earliest date that can be picked (YYYY-MM-DD). Reading past days is allowed, so most screens leave it out. */
  minimumDate?: string;
  /** Rendered inside a violet ScreenHeader: white chips on the violet surface. */
  onViolet?: boolean;
}

/**
 * Today / Tomorrow / Week / a picked date, as one row of chips above a timetable. The last chip
 * opens the same calendar DatePickerField uses, and shows the picked date once there is one.
 */
export function TimetableDateBar({ value, onChange, showWeek = false, minimumDate, onViolet = false }: Props) {
  const { t, i18n } = useTranslation();
  const [picking, setPicking] = useState(false);
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const pickedOther = value !== null && value !== today && value !== tomorrow;

  const chip = (key: string, label: string, active: boolean, onPress: () => void, icon?: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.chip, onViolet && styles.chipOnViolet, active && (onViolet ? styles.chipActiveOnViolet : styles.chipActive)]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {icon && (
        <FontAwesome5
          name={icon}
          size={12}
          color={onViolet ? (active ? colors.primary : colors.onPrimary) : active ? colors.white : colors.textSecondary}
          style={styles.icon}
        />
      )}
      <Text style={[styles.chipText, onViolet && styles.chipTextOnViolet, active && (onViolet ? styles.chipTextActiveOnViolet : styles.chipTextActive)]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
        {chip('today', t('timetable.date.today'), value === today, () => onChange(today))}
        {chip('tomorrow', t('timetable.date.tomorrow'), value === tomorrow, () => onChange(tomorrow))}
        {showWeek && chip('week', t('timetable.date.week'), value === null, () => onChange(null))}
        {chip(
          'pick',
          pickedOther && value ? formatIsoDate(value, i18n.language) : t('timetable.date.pick'),
          pickedOther,
          () => setPicking(true),
          'calendar-alt'
        )}
      </ScrollView>
      {picking && (
        <DateTimePicker
          value={parseIsoDate(value ?? today)}
          mode="date"
          minimumDate={minimumDate ? parseIsoDate(minimumDate) : undefined}
          onChange={(event, date) => {
            setPicking(false);
            // Cancelling still calls this on Android, with the date it opened on.
            const picked = pickedDate(event, date);
            if (picked) onChange(toIsoDate(picked));
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: spacing.sm },
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOnViolet: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'transparent' },
  chipActiveOnViolet: { backgroundColor: colors.white, borderColor: colors.white },
  icon: { marginRight: spacing.xs },
  chipText: { fontFamily: fonts.headingMedium, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  chipTextOnViolet: { color: colors.onPrimary },
  chipTextActiveOnViolet: { color: colors.primary },
});
