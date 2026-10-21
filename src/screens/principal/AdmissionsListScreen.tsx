import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listAdmissions } from '../../api/admissions';
import type { Admission, AdmissionStage } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { ADMISSION_STAGES, stageVariant } from '../../utils/admissionStages';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AdmissionsList'>;

/** Admin-only: every admission application, filterable by stage. */
export function AdmissionsListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [stage, setStage] = useState<AdmissionStage | null>(null);
  const [rows, setRows] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return listAdmissions(schoolId, stage ?? undefined)
      .then(setRows)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, stage]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const filters: (AdmissionStage | null)[] = [null, ...ADMISSION_STAGES];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('admissions.listTitle')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('NewAdmission')}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
          <Text style={styles.addButtonText}>{t('admissions.newButton')}</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          {filters.map((value) => {
            const selected = stage === value;
            return (
              <Pressable
                key={value ?? 'ALL'}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setStage(value)}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {value ? t(`admissions.stages.${value}`) : t('admissions.filters.all')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error && <ErrorNotice message={error} />}
        {loading && rows.length === 0 && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={rows}
          keyExtractor={(item) => item.id}
          refreshing={loading && rows.length > 0}
          onRefresh={load}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error ? t('admissions.loadError') : stage ? t('admissions.emptyFiltered') : t('admissions.empty')}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('AdmissionDetail', { admissionId: item.id })}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.studentName}</Text>
                <Text style={styles.rowMeta}>
                  {t('admissions.appliedFor', { className: item.appliedClassName })} · {item.parentName} · {item.parentContact}
                </Text>
                <Text style={styles.rowMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <StatusChip label={t(`admissions.stages.${item.stage}`)} variant={stageVariant(item.stage)} />
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  chipsScroll: { flexGrow: 0, marginBottom: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
});
