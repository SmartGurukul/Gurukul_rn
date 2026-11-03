import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBottomInset } from '../hooks/useBottomInset';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  required?: boolean;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateString(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export default function DateField({
  label,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  required,
}: Props) {
  const sheetBottom = useBottomInset(spacing.xl);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentDate = value ? parseDateString(value) : new Date();

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Web uses the same one-shot dialog flow as Android (see src/web/dateTimePicker.tsx).
    if (Platform.OS !== 'ios') {
      setOpen(false);
      if (event.type === 'set' && selected) onChange(toDateString(selected));
      return;
    }
    if (selected) onChange(toDateString(selected));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={value ? styles.value : styles.placeholder}>{value || placeholder || t('common.selectDate')}</Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>

      {open && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="calendar"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <DateTimePicker
                value={currentDate}
                mode="date"
                display="inline"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
              <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>{t('common.done')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  required: { color: colors.error },
  field: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { fontSize: 15, color: colors.textPrimary },
  placeholder: { fontSize: 15, color: colors.textMuted },
  icon: { fontSize: 15, marginLeft: spacing.sm },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 26, 43, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  doneButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  doneText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
