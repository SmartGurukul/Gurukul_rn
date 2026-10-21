import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listClassNames } from '../../api/classSections';
import { listEvents } from '../../api/events';
import type { SchoolEvent } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EventsList'>;

const CATEGORY_ICON: Record<string, string> = {
  SPORTS: 'running',
  CULTURAL: 'palette',
  ACADEMIC: 'book',
  OTHER: 'star',
};

const SCOPE_TAG: Record<string, { label: string; color: string }> = {
  SCHOOL: { label: 'School-wide', color: '#0369A1' },
  GRADE: { label: 'Grade', color: '#7C3AED' },
  CLASS: { label: 'Class', color: '#059669' },
};

function scopeLabel(event: SchoolEvent): string {
  const tag = SCOPE_TAG[event.scope ?? ''];
  if (!tag) return '';
  if (event.scope === 'GRADE' && event.className) return `Grade ${event.className}`;
  return tag.label;
}

function statusVariant(status: string | null): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  switch (status) {
    case 'UPCOMING':
      return 'info';
    case 'ONGOING':
      return 'success';
    case 'CANCELLED':
      return 'error';
    default:
      return 'neutral';
  }
}

export function EventsListScreen({ navigation }: Props) {
  const listBottom = useBottomInset();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const canCreate = session.ownerType === 'EMPLOYEE';
  // Teachers/admin can see events across every grade, so a grade filter helps them browse one at a
  // time. A student's GRADE-scoped events are already limited to their own grade server-side, so
  // this filter isn't shown to them - there'd be nothing else to toggle to.
  const canFilterByGrade = session.ownerType === 'EMPLOYEE';
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canFilterByGrade) listClassNames(schoolId).then(setClassNames).catch(() => setClassNames([]));
  }, [schoolId, canFilterByGrade]);

  const load = useCallback(() => {
    setError(null);
    // The events API also serves the older finance-only records (no category/participation) -
    // this screen is specifically the school-events feature, so only show entries that opted in.
    return listEvents(schoolId, gradeFilter ?? undefined)
      .then((all) => setEvents(all.filter((e) => e.category !== null)))
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, gradeFilter]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="School Events" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {canCreate && (
          <Pressable style={styles.addButton} onPress={() => navigation.navigate('EventForm')}>
            <FontAwesome5 name="plus" size={14} color={colors.white} />
            <Text style={styles.addButtonText}>Create event</Text>
          </Pressable>
        )}

        {canFilterByGrade && classNames.length > 0 && (
          <View style={styles.chips}>
            <Pressable style={[styles.chip, gradeFilter === null && styles.chipSelected]} onPress={() => setGradeFilter(null)}>
              <Text style={[styles.chipText, gradeFilter === null && styles.chipTextSelected]}>All grades</Text>
            </Pressable>
            {classNames.map((name) => (
              <Pressable
                key={name}
                style={[styles.chip, gradeFilter === name && styles.chipSelected]}
                onPress={() => setGradeFilter(name)}
              >
                <Text style={[styles.chipText, gradeFilter === name && styles.chipTextSelected]}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {error && <ErrorNotice message={error} />}
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={events}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>{error ? 'Could not load events.' : 'No events yet.'}</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}>
              <View style={styles.rowIcon}>
                <FontAwesome5 name={CATEGORY_ICON[item.category ?? 'OTHER'] ?? 'star'} size={16} color={colors.primary} />
              </View>
              <View style={styles.rowMain}>
                <View style={styles.rowTitleRow}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {item.scope && (
                    <View style={[styles.scopeTag, { backgroundColor: `${SCOPE_TAG[item.scope]?.color}22` }]}>
                      <Text style={[styles.scopeTagText, { color: SCOPE_TAG[item.scope]?.color }]}>{scopeLabel(item)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowMeta}>
                  {new Date(item.eventDate).toLocaleDateString()}
                  {item.venue ? ` · ${item.venue}` : ''}
                </Text>
              </View>
              {item.participationStatus && (
                <StatusChip label={item.participationStatus} variant={statusVariant(item.participationStatus)} />
              )}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
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
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  scopeTag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  scopeTagText: { fontSize: 10.5, fontWeight: '700' },
});
