import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listAuditEntityTypes, listAuditLogs } from '../../api/auditLog';
import type { AuditAction, AuditLogEntry } from '../../api/auditLog';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatAuditValue, humanize } from '../../utils/activityLogFormat';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ActivityLog'>;

const PAGE_SIZE = 50;
const accent = accents.activityLog;

const ACTION_COLORS: Record<AuditAction, { base: string; light: string }> = {
  CREATE: { base: '#059669', light: '#DFF5EC' },
  UPDATE: { base: '#2563EB', light: '#E3ECFD' },
  DELETE: { base: '#DC2626', light: '#FDE4E4' },
};

export function ActivityLogScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [entityType, setEntityType] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadFirstPage = useCallback(() => {
    return listAuditLogs(schoolId, { entityType, page: 0, size: PAGE_SIZE })
      .then((res) => {
        setEntries(res.content);
        setHasNext(res.hasNext);
        setPage(0);
      })
      .catch((e) => showToast(getErrorMessage(e), 'error'));
  }, [schoolId, entityType, showToast]);

  useEffect(() => {
    listAuditEntityTypes(schoolId)
      .then(setEntityTypes)
      .catch(() => setEntityTypes([]));
  }, [schoolId]);

  useEffect(() => {
    let active = true;
    loadFirstPage().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loadFirstPage]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFirstPage().finally(() => setRefreshing(false));
  };

  const handleLoadMore = () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    listAuditLogs(schoolId, { entityType, page: page + 1, size: PAGE_SIZE })
      .then((res) => {
        setEntries((prev) => [...prev, ...res.content]);
        setHasNext(res.hasNext);
        setPage(page + 1);
      })
      .catch((e) => showToast(getErrorMessage(e), 'error'))
      .finally(() => setLoadingMore(false));
  };

  const selectEntityType = (type: string | undefined) => {
    // Re-selecting the current filter wouldn't re-run the load effect, leaving the spinner stuck.
    if (type === entityType) return;
    setLoading(true);
    setEntityType(type);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderItem = ({ item }: { item: AuditLogEntry }) => {
    const actionColor = ACTION_COLORS[item.action];
    const fields = Object.entries(item.changes ?? {});
    const isOpen = expanded.has(item.id);
    return (
      <Pressable style={styles.row} onPress={() => toggle(item.id)} accessibilityRole="button">
        <View style={styles.rowHeader}>
          <View style={[styles.actionChip, { backgroundColor: actionColor.light }]}>
            <Text style={[styles.actionChipText, { color: actionColor.base }]}>
              {t(`activityLog.action.${item.action}`)}
            </Text>
          </View>
          <Text style={styles.entityType} numberOfLines={1}>
            {humanize(item.entityType)}
          </Text>
        </View>
        <Text style={styles.rowMeta}>
          {t('activityLog.by', { name: item.actorUsername, role: item.actorRole })}
          {' · '}
          {new Date(item.occurredAt).toLocaleString()}
        </Text>
        <Text style={styles.rowHint}>
          {isOpen
            ? t('activityLog.hideChanges')
            : t('activityLog.showChanges', { count: fields.length })}
        </Text>
        {isOpen ? (
          <View style={styles.changes}>
            {fields.length === 0 ? <Text style={styles.changeValue}>{t('activityLog.noFieldChanges')}</Text> : null}
            {fields.map(([field, change]) => (
              <View key={field} style={styles.changeRow}>
                <Text style={styles.changeField}>{humanize(field)}</Text>
                <Text style={styles.changeValue}>
                  {item.action === 'UPDATE'
                    ? `${formatAuditValue(change.old)}  →  ${formatAuditValue(change.new)}`
                    : formatAuditValue(item.action === 'DELETE' ? change.old : change.new)}
                </Text>
              </View>
            ))}
            <Text style={styles.recordId}>{t('activityLog.recordId', { id: item.entityId })}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('activityLog.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.intro}>{t('activityLog.intro')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterRow}>
          {[undefined, ...entityTypes].map((type) => {
            const selected = entityType === type;
            return (
              <Pressable
                key={type ?? '__all'}
                style={[styles.filterChip, selected && { backgroundColor: accent.base }]}
                onPress={() => selectEntityType(type)}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                  {type ? humanize(type) : t('activityLog.allTypes')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={accent.base} />
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={<Text style={styles.empty}>{t('activityLog.empty')}</Text>}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loader} color={accent.base} /> : null}
            contentContainerStyle={[styles.listContent, { paddingBottom: listBottom }]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  intro: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  filterBar: { flexGrow: 0, marginBottom: spacing.sm },
  filterRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  filterChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },
  loader: { marginTop: spacing.lg },
  listContent: { paddingBottom: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionChip: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  actionChipText: { fontSize: 12, fontWeight: '800' },
  entityType: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  rowHint: { fontSize: 12, color: accent.base, fontWeight: '600', marginTop: spacing.xs },
  changes: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceMuted,
    gap: spacing.xs,
  },
  changeRow: { gap: 2 },
  changeField: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  changeValue: { fontSize: 13, color: colors.textPrimary },
  recordId: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
});
