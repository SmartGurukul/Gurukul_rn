/**
 * Web stand-in for @react-native-community/datetimepicker. Every screen uses the Android pattern:
 * mount the picker to open it, and it calls onChange once - ('set', date) or ('dismissed') - after
 * which the screen unmounts it. Here mounting opens a small dialog holding the browser's own
 * <input type="date|time">. Wired in for web builds only, by metro.config.js.
 */
import { createElement, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export type DateTimePickerEvent = {
  type: 'set' | 'dismissed' | 'neutralButtonPressed';
  nativeEvent: { timestamp?: number; utcOffset?: number };
};

interface Props {
  value: Date;
  mode?: 'date' | 'time' | 'datetime' | 'countdown';
  minimumDate?: Date;
  maximumDate?: Date;
  onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  [key: string]: unknown;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function apply(base: Date, mode: string, input: string): Date | null {
  const next = new Date(base);
  if (mode === 'time') {
    const m = /^(\d{2}):(\d{2})/.exec(input);
    if (!m) return null;
    next.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return next;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) return null;
  next.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return next;
}

export default function DateTimePicker({ value, mode = 'date', minimumDate, maximumDate, onChange }: Props) {
  const { t } = useTranslation();
  const isTime = mode === 'time';
  const [text, setText] = useState(isTime ? timeValue(value) : dateValue(value));
  const [open, setOpen] = useState(true);

  const finish = (type: 'set' | 'dismissed') => {
    setOpen(false);
    const picked = type === 'set' ? apply(value, mode, text) : null;
    onChange?.({ type: picked ? 'set' : 'dismissed', nativeEvent: { timestamp: picked?.getTime() } }, picked ?? undefined);
  };

  const input = createElement('input', {
    type: isTime ? 'time' : 'date',
    value: text,
    min: !isTime && minimumDate ? dateValue(minimumDate) : undefined,
    max: !isTime && maximumDate ? dateValue(maximumDate) : undefined,
    autoFocus: true,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    style: { fontSize: 18, padding: 10, borderRadius: 10, border: '1px solid #DDD6FE', width: '100%', boxSizing: 'border-box' },
  });

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish('dismissed')}>
      <Pressable style={styles.backdrop} onPress={() => finish('dismissed')}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {input}
          <View style={styles.row}>
            <Pressable style={styles.button} onPress={() => finish('dismissed')}>
              <Text style={styles.cancel}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.ok]} onPress={() => finish('set')}>
              <Text style={styles.okText}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 10, 30, 0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  ok: { backgroundColor: '#7C3AED' },
  cancel: { color: '#6B7280', fontWeight: '600' },
  okText: { color: '#fff', fontWeight: '700' },
});
