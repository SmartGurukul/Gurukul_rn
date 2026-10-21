import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listInfraExpenseRequests } from '../../api/infraExpenseRequests';
import type { InfraExpenseRequest, InfraExpenseStatus } from '../../api/expenseTypes';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { INFRA_STATUS_FILTERS, infraRowSubtitle, infraStatusLabel, infraStatusVariant } from '../../utils/expenses';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InfraExpensesList'>;

export function InfraExpensesListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [requests, setRequests] = useState<InfraExpenseRequest[]>([]);
  const [status, setStatus] = useState<InfraExpenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the latest load may update the list or end the spinner, so a slow answer for the previous
  // filter can't win, and can't hide the spinner while the newer load is still running.
  const latestLoad = useRef(0);

  // The server filters and orders the list (newest first).
  const load = useCallback(() => {
    const id = ++latestLoad.current;
    setError(null);
    return listInfraExpenseRequests(schoolId, status)
      .then((rows) => {
        if (id === latestLoad.current) setRequests(rows);
      })
      .catch((e) => {
        if (id === latestLoad.current) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (id === latestLoad.current) setLoading(false);
      });
  }, [schoolId, status]);

  // On focus, and again whenever the filter changes.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  // A new filter empties the list first, so the old filter's rows never sit under the new chip:
  // the spinner shows until its rows arrive, or the error if they don't.
  const selectStatus = (value: InfraExpenseStatus | null) => {
    if (value === status) return;
    setRequests([]);
    setStatus(value);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('infraExpenses.list.title')}
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('InfraCategories')} accessibilityRole="button">
            <Text style={styles.headerButtonText}>{t('infraExpenses.list.categories')}</Text>
          </Pressable>
        }
      />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('InfraExpenseForm')}>
          <Text style={styles.addButtonText}>{t('infraExpenses.list.newRequest')}</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersRow}>
          {INFRA_STATUS_FILTERS.map((value) => {
            const selected = value === status;
            return (
              <Pressable
                key={value ?? 'ALL'}
                onPress={() => selectStatus(value)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {value ? infraStatusLabel(value, t) : t('infraExpenses.list.filterAll')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error && <ErrorNotice message={error} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={requests}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error
                  ? t('infraExpenses.list.loadError')
                  : status
                    ? t('infraExpenses.list.emptyFiltered')
                    : t('infraExpenses.list.empty')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('InfraExpenseDetail', { requestId: item.id, request: item })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={styles.rowMeta}>{infraRowSubtitle(item, t)}</Text>
              </View>
              <StatusChip label={infraStatusLabel(item.status, t)} variant={infraStatusVariant(item.status)} />
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
  headerButton: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
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
  filters: { flexGrow: 0, marginBottom: spacing.md },
  filtersRow: { gap: spacing.sm },
  filterChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
  },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  filterTextSelected: { color: colors.white },
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
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
