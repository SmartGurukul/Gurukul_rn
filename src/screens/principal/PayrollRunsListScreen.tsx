import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { listPayrollRuns } from '../../api/payrollRuns';
import type { PayrollRun } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatInr, runMonthLabel, runStatusLabel, runStatusVariant } from '../../utils/payroll';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayrollRunsList'>;

/** Every month's payroll run except cancelled ones, newest first. A run opens to finish, fix or pay it. */
export function PayrollRunsListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listPayrollRuns(schoolId)
      .then(setRuns)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  // Reloads on focus, so a run created, paid or cancelled on the run screen shows its new state here.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.runsList.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('PayrollRun')}>
          <Text style={styles.addButtonText}>{t('payroll.runsList.newRun')}</Text>
        </Pressable>

        {error && runs.length > 0 ? <ErrorNotice message={error} /> : null}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={runs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : error ? (
              <ErrorNotice message={`${t('payroll.runsList.loadError')} ${error}`} />
            ) : (
              <Text style={styles.empty}>{t('payroll.runsList.empty')}</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('PayrollRun', { runId: item.id })}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{runMonthLabel(item.month, item.year, t)}</Text>
                <Text style={styles.rowMeta}>
                  {t('payroll.runsList.rowSubtitle', { count: item.lineCount, total: formatInr(item.totalNet) })}
                </Text>
                {item.payableLineCount > 0 ? (
                  <Text style={styles.toPay}>{t('payroll.runsList.toPay', { amount: formatInr(item.payableNet) })}</Text>
                ) : null}
              </View>
              <StatusChip label={runStatusLabel(item.status, t)} variant={runStatusVariant(item.status)} />
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  toPay: { fontSize: 13, fontWeight: '700', color: accents.payroll.base, marginTop: 4 },
});
