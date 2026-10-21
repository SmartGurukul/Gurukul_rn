import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getGradingScale, replaceGradingScale } from '../../api/gradingScale';
import type { GradingBand } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import {
  describeGradingBands,
  gradingBandErrorMessage,
  gradingBandRowsToRequest,
  MAX_GRADE_LABEL_LENGTH,
  validateGradingBands,
  type GradingBandRow,
} from '../../utils/gradingScale';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'GradingScale'>;

interface BandRow extends GradingBandRow {
  key: string;
}

let nextKey = 0;
const newRowKey = () => `new-${nextKey++}`;

export function GradingScaleScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const keyboardInset = useKeyboardInset();
  const schoolId = useSchoolId();
  const [rows, setRows] = useState<BandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    getGradingScale(schoolId)
      .then((bands) => {
        setRows(
          bands.map((b) => ({
            key: b.id ?? newRowKey(),
            minPercentage: String(b.minPercentage),
            maxPercentage: String(b.maxPercentage),
            label: b.label,
          }))
        );
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const updateRow = (key: string, patch: Partial<BandRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { key: newRowKey(), minPercentage: '', maxPercentage: '', label: '' }]);
  };

  // Same checks as the server (0-100, min <= max, no gaps or overlaps, unique short labels), so the
  // problem shows here rather than as a failed save.
  const validationError = loading ? null : validateGradingBands(rows);
  const canSave = !loading && validationError === null;

  // `saving` only disables Save after the next render, so a quick double tap could stack two
  // confirmations and run two saves at once. This is set on the tap itself and held until the
  // confirmation is cancelled or the save finishes.
  const saveFlow = useRef(false);
  const endSaveFlow = () => {
    saveFlow.current = false;
  };

  const save = async (bands: Omit<GradingBand, 'id'>[]) => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await replaceGradingScale(schoolId, bands);
      setSuccess(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
      endSaveFlow();
    }
  };

  // Grades are worked out live from this scale, so saving regrades every report card - including
  // published ones families have already seen. Confirm first.
  const handleSave = () => {
    if (saveFlow.current) return;
    saveFlow.current = true;
    const bands = gradingBandRowsToRequest(rows);
    Alert.alert(
      t('gradingScale.confirmTitle'),
      t('gradingScale.confirmBody', { bands: describeGradingBands(bands) }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: endSaveFlow },
        { text: t('common.save'), onPress: () => save(bands) },
      ],
      { onDismiss: endSaveFlow }
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('gradingScale.title')}
        subtitle={t('gradingScale.subtitle')}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: spacing.xl + keyboardInset }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>{t('gradingScale.description')}</Text>

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <ErrorNotice message={error} />}
        {success && <Text style={styles.success}>{t('gradingScale.saved')}</Text>}

        {!loading &&
          rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={row.minPercentage}
                onChangeText={(text) => updateRow(row.key, { minPercentage: text })}
                keyboardType="numeric"
                placeholder={t('gradingScale.minPlaceholder')}
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.dash}>–</Text>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={row.maxPercentage}
                onChangeText={(text) => updateRow(row.key, { maxPercentage: text })}
                keyboardType="numeric"
                placeholder={t('gradingScale.maxPlaceholder')}
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.inputLabel]}
                value={row.label}
                onChangeText={(text) => updateRow(row.key, { label: text })}
                placeholder={t('gradingScale.gradePlaceholder')}
                maxLength={MAX_GRADE_LABEL_LENGTH}
                placeholderTextColor={colors.textMuted}
              />
              <Pressable style={styles.removeButton} onPress={() => removeRow(row.key)}>
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            </View>
          ))}

        {!loading && (
          <Pressable style={styles.addButton} onPress={addRow}>
            <Text style={styles.addButtonText}>{t('gradingScale.addBand')}</Text>
          </Pressable>
        )}

        {validationError && (rows.length > 0 || !error) && (
          <Text style={styles.validation}>{gradingBandErrorMessage(validationError, t)}</Text>
        )}

        {!loading && (
          <Pressable
            style={[styles.saveButton, (!canSave || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>{t('gradingScale.save')}</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.lg },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  validation: { color: colors.warning, marginBottom: spacing.md, fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputSmall: { width: 56, textAlign: 'center' },
  inputLabel: { flex: 1 },
  dash: { color: colors.textMuted },
  removeButton: { padding: spacing.xs },
  removeButtonText: { color: colors.error, fontWeight: '700', fontSize: 16 },
  addButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addButtonText: { color: colors.primary, fontWeight: '700' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  saveButtonText: { color: colors.white, fontWeight: '700' },
});
