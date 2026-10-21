import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { listMyCallHistory, listSchoolCallHistory } from '../../api/calls';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { CallLogResponse } from '../../api/types';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'CallHistory'>;

const PAGE_SIZE = 50;

export function CallHistoryScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [logs, setLogs] = useState<CallLogResponse[]>([]);
  const [showWholeSchool, setShowWholeSchool] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    (pageToLoad: number, append: boolean) => {
      const fetch = showWholeSchool
        ? listSchoolCallHistory(schoolId, pageToLoad, PAGE_SIZE)
        : listMyCallHistory(schoolId, pageToLoad, PAGE_SIZE);
      return fetch
        .then((res) => {
          setLogs((prev) => (append ? [...prev, ...res.content] : res.content));
          setHasNext(res.hasNext);
          setPage(pageToLoad);
        })
        .catch((e) => setError(getErrorMessage(e)));
    },
    [schoolId, showWholeSchool]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  const handleLoadMore = () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    load(page + 1, true).finally(() => setLoadingMore(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Call history" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {session.role === 'ADMIN' && (
          <View style={styles.toggleRow}>
            <Text
              style={[styles.toggleOption, !showWholeSchool && styles.toggleOptionActive]}
              onPress={() => setShowWholeSchool(false)}
            >
              My calls
            </Text>
            <Text
              style={[styles.toggleOption, showWholeSchool && styles.toggleOptionActive]}
              onPress={() => setShowWholeSchool(true)}
            >
              Whole school
            </Text>
          </View>
        )}
        {error && <ErrorNotice message={error} />}
        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={logs}
          keyExtractor={(log) => log.id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.empty}>No calls yet.</Text>
            )
          }
          renderItem={({ item: log }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{new Date(log.startedAt).toLocaleString()}</Text>
                <StatusChip label={log.outcome} variant={outcomeVariant(log.outcome)} />
              </View>
              <Text style={styles.cardMeta}>
                {log.scheduledCallId ? 'Scheduled call' : 'Immediate call'}
                {log.durationSeconds != null ? ` · ${Math.round(log.durationSeconds / 60)} min` : ''}
              </Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

function outcomeVariant(outcome: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  if (outcome === 'COMPLETED') return 'success';
  if (outcome === 'MISSED' || outcome === 'DECLINED' || outcome === 'BUSY') return 'warning';
  if (outcome === 'CANCELLED') return 'neutral';
  return 'info';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  footerLoader: { marginVertical: spacing.md },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleOption: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  toggleOptionActive: { color: colors.white, backgroundColor: colors.primary },
  empty: { color: colors.textMuted },
  error: { color: colors.error, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
