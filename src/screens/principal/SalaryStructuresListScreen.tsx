import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listSalaryStructures } from '../../api/salaryStructures';
import type { SalaryStructure } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { localToday } from '../../utils/assessmentStatus';
import { formatAmount, formatInr, formatPayrollDate } from '../../utils/payroll';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryStructuresList'>;

export function SalaryStructuresListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(null);
    return listSalaryStructures(schoolId)
      .then(setStructures)
      .catch((e) => {
        setError(getErrorMessage(e));
        showToast(getErrorMessage(e), 'error');
      });
  }, [schoolId, showToast]);

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

  const today = localToday();

  // A structure behind a paid month can't change (that would rewrite paid salary): offer a new one instead.
  const openStructure = (item: SalaryStructure) => {
    if (item.editable) {
      navigation.navigate('SalaryStructureForm', { structure: item });
      return;
    }
    Alert.alert(item.employeeName, t('payroll.salaryStructuresList.lockedHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('payroll.salaryStructuresList.newForEmployee', { name: item.employeeName }),
        onPress: () =>
          navigation.navigate('SalaryStructureForm', { employee: { id: item.employeeId, name: item.employeeName } }),
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.salaryStructuresList.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('SalaryStructureForm')}>
          <Text style={styles.addButtonText}>{t('payroll.salaryStructuresList.addButton')}</Text>
        </Pressable>

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={structures}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error ? t('payroll.salaryStructuresList.loadError') : t('payroll.salaryStructuresList.empty')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openStructure(item)}>
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <Text style={styles.rowName}>{item.employeeName}</Text>
                  {item.current && <StatusChip label={t('payroll.salaryStructuresList.current')} variant="success" />}
                  {item.effectiveFrom > today && (
                    <StatusChip
                      label={t('payroll.salaryStructuresList.startsOn', { date: formatPayrollDate(item.effectiveFrom, t) })}
                      variant="info"
                    />
                  )}
                </View>
                <Text style={styles.rowMeta}>
                  {t('payroll.salaryStructuresList.rowSubtitle', {
                    basic: formatAmount(item.basic),
                    allowances: formatAmount(item.allowances),
                    deductions: formatAmount(item.deductions),
                  })}
                </Text>
                <Text style={styles.rowMeta}>
                  {t('payroll.salaryStructuresList.effectiveFrom', { date: formatPayrollDate(item.effectiveFrom, t) })}
                </Text>
                {item.net <= 0 && <Text style={styles.badNet}>{t('payroll.salaryStructuresList.badNet')}</Text>}
              </View>
              <Text style={[styles.rowNet, item.net <= 0 && styles.rowNetBad]}>{formatInr(item.net)}</Text>
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
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badNet: { fontSize: 12, color: colors.error, fontWeight: '600', marginTop: spacing.xs },
  rowNet: { fontSize: 14, color: accents.payroll.base, fontWeight: '800' },
  rowNetBad: { color: colors.error },
});
