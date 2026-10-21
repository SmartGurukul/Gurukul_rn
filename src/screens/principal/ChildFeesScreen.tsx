import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listStudentFeeAssessments } from '../../api/feeAssessments';
import type { FeeAssessment } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatRupees } from '../../utils/money';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { billDueNote, feeStatusLabel, feeStatusVariant } from '../../utils/feeBills';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChildFees'>;

export function ChildFeesScreen({ route, navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const student = route.params.student;
  // Kept with the child they're for, so another child's bills never show under this one's name.
  const [loaded, setLoaded] = useState<{ studentId: string; bills: FeeAssessment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Each load takes the next number; only the latest one's reply is shown and clears the spinners.
  const latestRequest = useRef(0);
  const assessments = loaded?.studentId === student.id ? loaded.bills : [];

  const load = useCallback(() => {
    const id = ++latestRequest.current;
    setError(null);
    return listStudentFeeAssessments(schoolId, student.id)
      .then((bills) => {
        if (id === latestRequest.current) setLoaded({ studentId: student.id, bills });
      })
      .catch((e) => {
        if (id === latestRequest.current) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (id !== latestRequest.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [schoolId, student.id]);

  // On focus, so coming back from a bill shows any change made to it meanwhile; and again when the
  // params name another child while this screen is showing (a FEE_DUE push for a second child
  // navigates to this same screen, which only swaps the params).
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('childFees.title', { name: student.name })} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable
          style={styles.historyButton}
          onPress={() => navigation.navigate('StudentFeePayments', { student })}
          accessibilityRole="button"
        >
          <Text style={styles.historyButtonText}>{t('fees.paymentHistory.title')}</Text>
        </Pressable>
        {error && <ErrorNotice message={error} />}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={assessments}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>{error ? t('childFees.loadError') : t('childFees.empty')}</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const dueNote = billDueNote(item, t);
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('FeeAssessmentDetail', { assessment: item })}
                accessibilityRole="button"
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{item.academicYear}</Text>
                  <Text style={styles.rowMeta}>
                    {t('myFees.due', {
                      remaining: formatRupees(item.remainingDue, { symbol: false }),
                      total: formatRupees(item.totalDue, { symbol: false }),
                    })}
                  </Text>
                  {dueNote && (
                    <Text style={[styles.rowMeta, dueNote.tone === 'error' && styles.overdue]}>{dueNote.text}</Text>
                  )}
                </View>
                <StatusChip label={feeStatusLabel(item.status, t)} variant={feeStatusVariant(item.status)} />
              </Pressable>
            );
          }}
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
  overdue: { color: colors.error, fontWeight: '600' },
  historyButton: { alignSelf: 'flex-end', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  historyButtonText: { color: colors.primary, fontWeight: '700' },
});
