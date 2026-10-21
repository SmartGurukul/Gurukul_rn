import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getEmployee, isActiveEmployee, searchEmployees } from '../../api/employees';
import { listStudentsInClassSection } from '../../api/classSections';
import { getSectionAttendance, markSectionAttendance } from '../../api/attendance';
import type { AttendanceMethod, AttendanceStatus, ClassSection, Employee, Student } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { useBottomInset } from '../../hooks/useBottomInset';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

interface Props {
  classSection: ClassSection;
}

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];
const SEARCH_DEBOUNCE_MS = 300;

const statusColor: Record<AttendanceStatus, string> = {
  PRESENT: colors.success,
  ABSENT: colors.error,
  LATE: colors.marigold,
  HALF_DAY: colors.textSecondary,
};

/** The letter on each pill; the full word is the accessibility label. */
const statusLetter: Record<AttendanceStatus, string> = { PRESENT: 'P', ABSENT: 'A', LATE: 'L', HALF_DAY: 'H' };
const statusWord: Record<AttendanceStatus, string> = { PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', HALF_DAY: 'Half day' };

const methodLabel: Record<AttendanceMethod, string> = {
  RFID: 'card',
  FINGERPRINT: 'fingerprint',
  FACE: 'face',
};

export function AttendanceTakeBody({ classSection }: Props) {
  const schoolId = useSchoolId();
  const footerBottom = useBottomInset();
  const keyboardInset = useKeyboardInset();
  const { session } = useAuth();
  const isAdmin = session.role === 'ADMIN';

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [methods, setMethods] = useState<Record<string, AttendanceMethod | null>>({});
  const [teacherId, setTeacherId] = useState<string | null>(isAdmin ? classSection.classTeacherId : session.ownerId);
  const [teacherLabel, setTeacherLabel] = useState(isAdmin ? (classSection.classTeacherName ?? '') : '');

  // Admin-only: search for a different marker than the section's default class teacher.
  const [showTeacherSearch, setShowTeacherSearch] = useState(isAdmin && !classSection.classTeacherId);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherResults, setTeacherResults] = useState<Employee[]>([]);
  const [searchingTeachers, setSearchingTeachers] = useState(false);

  const [loadingRoster, setLoadingRoster] = useState(true);
  const [loadingDate, setLoadingDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    listStudentsInClassSection(schoolId, classSection.id)
      .then(setRoster)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoadingRoster(false));
  }, [schoolId, classSection.id]);

  // Non-admins can only ever mark as themselves (the backend enforces this and ignores any
  // other teacherId they send) - just look up their own name for a friendly label.
  useEffect(() => {
    if (isAdmin) return;
    getEmployee(schoolId, session.ownerId)
      .then((me) => setTeacherLabel(`${me.name} (you)`))
      .catch(() => setTeacherLabel('you'));
  }, [isAdmin, schoolId, session.ownerId]);

  useEffect(() => {
    if (!isAdmin || !showTeacherSearch || teacherQuery.trim().length < 2) {
      setTeacherResults([]);
      return;
    }
    let cancelled = false;
    setSearchingTeachers(true);
    const handle = setTimeout(() => {
      searchEmployees(schoolId, teacherQuery.trim())
        .then((results) => !cancelled && setTeacherResults(results.filter(isActiveEmployee)))
        .catch(() => !cancelled && setTeacherResults([]))
        .finally(() => !cancelled && setSearchingTeachers(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [isAdmin, showTeacherSearch, teacherQuery, schoolId]);

  const handleLoadDate = () => {
    setLoadingDate(true);
    setError(null);
    setSuccess(false);
    getSectionAttendance(schoolId, classSection.id, date)
      .then((res) => {
        const nextStatuses: Record<string, AttendanceStatus> = {};
        const nextMethods: Record<string, AttendanceMethod | null> = {};
        res.entries.forEach((entry) => {
          nextStatuses[entry.studentId] = entry.status;
          nextMethods[entry.studentId] = entry.method;
        });
        setStatuses(nextStatuses);
        setMethods(nextMethods);
      })
      .catch(() => {
        setStatuses({});
        setMethods({});
      })
      .finally(() => setLoadingDate(false));
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    // Saving will clear any device attribution for this student's record (teacher's mark takes
    // over, matching AttendanceService.markSection) - drop the stale badge here too.
    setMethods((prev) => ({ ...prev, [studentId]: null }));
  };

  const markAllPresent = () => {
    setStatuses((prev) => {
      const next = { ...prev };
      roster.forEach((s) => (next[s.id] = 'PRESENT'));
      return next;
    });
  };

  const allMarkedPresent = roster.length > 0 && roster.every((s) => statuses[s.id] === 'PRESENT');

  const selectTeacher = (employee: Employee) => {
    setTeacherId(employee.id);
    setTeacherLabel(`${employee.name} (${employee.designation})`);
    setShowTeacherSearch(false);
    setTeacherQuery('');
  };

  const canSubmit = !!teacherId && roster.every((s) => !!statuses[s.id]);
  const marked = roster.filter((s) => !!statuses[s.id]).length;
  const countOf = (status: AttendanceStatus) => roster.filter((s) => statuses[s.id] === status).length;

  const handleSubmit = async () => {
    if (!teacherId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await markSectionAttendance(schoolId, classSection.id, {
        date,
        teacherId,
        records: roster.map((s) => ({
          studentId: s.id,
          status: statuses[s.id] ?? 'PRESENT',
        })),
      });
      setSuccess(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenContainer contentContainerStyle={{ paddingBottom: footerBottom + SUBMIT_HEIGHT + spacing.lg }}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>
              {roster.length === 0 ? 'No students yet' : `${marked} of ${roster.length} marked`}
            </Text>
            <View style={styles.heroCounts}>
              <Text style={[styles.heroCount, { color: colors.success }]}>{countOf('PRESENT')}</Text>
              <Text style={[styles.heroCount, { color: colors.error }]}>{countOf('ABSENT')}</Text>
              <Text style={[styles.heroCount, { color: colors.warning }]}>{countOf('LATE') + countOf('HALF_DAY')}</Text>
            </View>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: roster.length ? `${Math.round((marked / roster.length) * 100)}%` : '0%' }]} />
          </View>
          <View style={styles.heroDate}>
            <DatePickerField label="Date" value={date} onChange={setDate} />
            <Pressable style={styles.loadButton} onPress={handleLoadDate} disabled={loadingDate} accessibilityRole="button">
              <Text style={styles.loadButtonText}>{loadingDate ? 'Loading…' : 'Load saved'}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.label}>Marked by</Text>
        {!isAdmin ? (
          <View style={styles.fixedMarker}>
            <Text style={styles.fixedMarkerText}>
              You&apos;ll mark this as <Text style={styles.fixedMarkerName}>{teacherLabel || '…'}</Text>
            </Text>
          </View>
        ) : !showTeacherSearch ? (
          <View style={styles.markerCard}>
            <View style={styles.markerCardBody}>
              <Text style={styles.markerCardLabel}>Class teacher</Text>
              <Text style={styles.markerCardName}>{teacherLabel || 'Not set'}</Text>
            </View>
            <Pressable onPress={() => setShowTeacherSearch(true)} accessibilityRole="button">
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <SearchBar
              value={teacherQuery}
              onChangeText={setTeacherQuery}
              placeholder="Search for who's marking by name…"
            />
            {searchingTeachers && <ActivityIndicator color={colors.primary} style={styles.searchLoading} />}
            {!searchingTeachers &&
              teacherQuery.trim().length >= 2 &&
              teacherResults.map((employee) => (
                <Pressable key={employee.id} style={styles.teacherRow} onPress={() => selectTeacher(employee)}>
                  <Text style={styles.teacherRowText}>
                    {employee.name} ({employee.designation})
                  </Text>
                </Pressable>
              ))}
            {!searchingTeachers && teacherQuery.trim().length >= 2 && teacherResults.length === 0 && (
              <Text style={styles.empty}>No one matches that search.</Text>
            )}
            {classSection.classTeacherId && (
              <Pressable
                onPress={() => {
                  setTeacherId(classSection.classTeacherId);
                  setTeacherLabel(classSection.classTeacherName ?? '');
                  setShowTeacherSearch(false);
                  setTeacherQuery('');
                }}
              >
                <Text style={styles.changeLink}>Use class teacher ({classSection.classTeacherName})</Text>
              </Pressable>
            )}
          </View>
        )}

        {loadingRoster && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && <ErrorNotice message={error} />}
        {success && <Text style={styles.success}>Attendance saved for {date}.</Text>}

        {!loadingRoster && roster.length === 0 && (
          <Text style={styles.empty}>0 students in this section.</Text>
        )}

        {roster.length > 0 && (
          <View style={styles.listHeader}>
            <Text style={styles.label}>Students</Text>
            <Pressable onPress={markAllPresent} disabled={allMarkedPresent} accessibilityRole="button" style={allMarkedPresent && styles.disabled}>
              <Text style={styles.changeLink}>Mark all present</Text>
            </Pressable>
          </View>
        )}

        {roster.length > 0 && (
          <View style={styles.listCard}>
            {roster.map((student, index) => {
              const method = methods[student.id];
              return (
                <View key={student.id} style={[styles.studentRow, index === roster.length - 1 && styles.studentRowLast]}>
                  <View style={styles.rollTile}>
                    <Text style={styles.rollText} numberOfLines={1} adjustsFontSizeToFit>
                      {student.rollNumber || '–'}
                    </Text>
                  </View>
                  <View style={styles.studentText}>
                    <Text style={styles.studentName} numberOfLines={1}>
                      {student.name}
                    </Text>
                    {method ? <Text style={styles.studentMeta}>Marked by {methodLabel[method]} device</Text> : null}
                  </View>
                  <View style={styles.statusRow}>
                    {STATUSES.map((status) => {
                      const selected = statuses[student.id] === status;
                      return (
                        <Pressable
                          key={status}
                          style={[styles.pill, selected && { backgroundColor: statusColor[status], borderColor: statusColor[status] }]}
                          onPress={() => setStatus(student.id, status)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${student.name}: ${statusWord[status]}`}
                          hitSlop={4}
                        >
                          <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{statusLetter[status]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScreenContainer>

      {roster.length > 0 && (
        <View style={[styles.footer, { paddingBottom: footerBottom, bottom: keyboardInset }]}>
          <Pressable
            style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Submit attendance'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const SUBMIT_HEIGHT = 52;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: tints.mint.bg,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  heroTitle: { fontFamily: fonts.headingMedium, fontSize: 15, lineHeight: 20, color: colors.textPrimary, flexShrink: 1 },
  heroCounts: { flexDirection: 'row', gap: spacing.md },
  heroCount: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surface, marginTop: spacing.md, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  heroDate: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginBottom: spacing.sm },
  loadButton: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  loadButtonText: { color: tints.mint.fg, fontFamily: fonts.headingMedium, fontSize: 13 },
  loading: { marginVertical: spacing.md },
  success: { color: colors.success, marginVertical: spacing.md, fontFamily: fonts.bodySemibold, fontSize: 14 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, fontFamily: fonts.body, fontSize: 15 },
  fixedMarker: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fixedMarkerText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  fixedMarkerName: { fontFamily: fonts.bodySemibold, color: colors.textPrimary },
  markerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  markerCardBody: { flex: 1 },
  markerCardLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  markerCardName: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary, marginTop: 2 },
  changeLink: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 13 },
  searchLoading: { marginVertical: spacing.sm },
  teacherRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teacherRowText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textPrimary },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  studentRowLast: { borderBottomWidth: 0 },
  rollTile: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollText: { fontFamily: fonts.headingMedium, fontSize: 12, color: colors.primary },
  studentText: { flex: 1 },
  studentName: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  studentMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  statusRow: { flexDirection: 'row', gap: 6 },
  pill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.headingMedium, fontSize: 13, color: colors.textMuted },
  pillTextSelected: { color: colors.onPrimary },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  submit: {
    height: SUBMIT_HEIGHT,
    backgroundColor: colors.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.onPrimary, fontFamily: fonts.headingMedium, fontSize: 16 },
});
