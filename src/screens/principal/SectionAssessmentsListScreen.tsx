import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listSectionAssessments } from '../../api/assessments';
import type { Assessment } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useBottomInset } from '../../hooks/useBottomInset';
import { useSectionAssignments } from '../../hooks/useSectionAssignments';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { assessmentTypeLabel } from '../../utils/assessmentLabels';
import { actionAccess, assessmentPermissions, rightsDependOnAssignments } from '../../utils/assessmentPermissions';
import { assessmentStatus, localToday } from '../../utils/assessmentStatus';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionAssessmentsList'>;

export function SectionAssessmentsListScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const listBottom = useBottomInset();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const classSection = route.params.classSection;
  const isStaff = session.role === 'ADMIN' || session.role === 'TEACHER';
  const sectionAssignments = useSectionAssignments(schoolId, isStaff ? classSection.id : null);
  const canCreate = assessmentPermissions(session, classSection, sectionAssignments.assignments).canCreateAssessment;
  const assignmentsMatter = rightsDependOnAssignments(session, classSection);
  const createAccess = actionAccess(canCreate, assignmentsMatter, sectionAssignments.loading);
  const today = localToday();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const names = new Set<string>();
    assessments.forEach((a) => a.subjectName && names.add(a.subjectName));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [assessments]);

  const visibleAssessments = useMemo(
    () => (subjectFilter ? assessments.filter((a) => a.subjectName === subjectFilter) : assessments),
    [assessments, subjectFilter]
  );

  const load = useCallback(() => {
    setError(null);
    return listSectionAssessments(schoolId, classSection.id)
      .then(setAssessments)
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId, classSection.id]);

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
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle={t('assessments.list.subtitle')}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.body}>
        {createAccess === 'allowed' ? (
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate('AssessmentForm', { classSection })}
          >
            <Text style={styles.addButtonText}>{t('assessments.list.new')}</Text>
          </Pressable>
        ) : createAccess === 'checking' ? (
          // A subject teacher's "+ New assessment" waits on their subjects - say so rather than show nothing.
          <View style={styles.checkingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.checkingText}>{t('assessments.checkingSubjects')}</Text>
          </View>
        ) : null}

        {error && <ErrorNotice message={error} />}

        {assignmentsMatter && sectionAssignments.error && (
          <View style={styles.assignmentsNotice}>
            <Text style={styles.assignmentsNoticeText}>{t('assessments.subjectsCheckFailed')}</Text>
            <Pressable onPress={sectionAssignments.reload} disabled={sectionAssignments.loading}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {subjects.length > 1 && (
          <View style={styles.subjectFilterRow}>
            <Pressable
              style={[styles.subjectChip, subjectFilter === null && styles.subjectChipSelected]}
              onPress={() => setSubjectFilter(null)}
            >
              <Text style={[styles.subjectChipText, subjectFilter === null && styles.subjectChipTextSelected]}>
                {t('assessments.list.all')}
              </Text>
            </Pressable>
            {subjects.map((subject) => (
              <Pressable
                key={subject}
                style={[styles.subjectChip, subjectFilter === subject && styles.subjectChipSelected]}
                onPress={() => setSubjectFilter(subject)}
              >
                <Text style={[styles.subjectChipText, subjectFilter === subject && styles.subjectChipTextSelected]}>
                  {subject}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: listBottom }}
          data={visibleAssessments}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error
                  ? t('assessments.list.loadFailed')
                  : subjectFilter
                    ? t('assessments.list.emptySubject', { subject: subjectFilter })
                    : canCreate
                      ? t('assessments.list.emptyCanCreate')
                      : t('assessments.list.empty')}
              </Text>
            )
          }
          renderItem={({ item }) => {
            const status = assessmentStatus(
              item.assessmentDate,
              today,
              { entered: item.marksEnteredCount, expected: item.marksExpectedCount },
              isStaff,
              t
            );
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('AssessmentDetail', { assessment: item, classSection })}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{item.title}</Text>
                  <Text style={styles.rowMeta}>
                    {[item.subjectName, item.assessmentDate, t('assessments.list.maxMarks', { max: item.maxMarks })]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.chipStack}>
                  <StatusChip label={assessmentTypeLabel(item.type, t)} variant="neutral" />
                  <StatusChip label={status.label} variant={status.variant} />
                </View>
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
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  checkingText: { fontSize: 13, color: colors.textMuted },
  subjectFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  subjectChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  subjectChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  subjectChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  subjectChipTextSelected: { color: colors.white },
  error: { color: colors.error, marginBottom: spacing.md },
  assignmentsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  assignmentsNoticeText: { flex: 1, fontSize: 12, color: colors.textMuted },
  retryText: { color: colors.primary, fontWeight: '700' },
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
  chipStack: { alignItems: 'flex-end', gap: spacing.xs },
});
