import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listSectionAssessments } from '../../api/assessments';
import { getStudentAttendanceHistory } from '../../api/attendance';
import { getErrorMessage } from '../../api/errorMessage';
import { listStudentFeeAssessments } from '../../api/feeAssessments';
import { getMyChildren } from '../../api/parents';
import { getSchool } from '../../api/schools';
import type { Assessment, Student } from '../../api/types';
import { toIsoDate } from '../../components/DatePickerField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { HeroCard, type HeroStat } from '../../components/HeroCard';
import { ParentCommsTiles } from '../../components/ParentCommsTiles';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useLanguage } from '../../i18n/useLanguage';
import { colors, radius, spacing, tintAt, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import { compactInr, longDate } from '../../utils/homeSummary';
import { feeDueSummary, statusOn } from '../../utils/parentHome';
import { formatIsoDate, todayIso } from '../../utils/timetable';
import { upcomingCardState } from '../../utils/upcomingAssessments';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ChildDashboard'>;

/**
 * The child's next tests and exams, read-only: families can't open an assessment (that screen is
 * for staff), and marks are never in this list. A failed load says so with a retry rather than
 * looking like there's nothing coming up.
 *
 * For a parent with one child this is their home screen and stays mounted under Attendance, Fees
 * and the rest, so the list reloads whenever the screen regains focus or the app comes back to the
 * foreground on it: new assessments show up, and ones whose day has passed drop off.
 */
function UpcomingAssessmentsCard({ classSectionId }: { classSectionId: string }) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [list, setList] = useState<Assessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => toIsoDate(new Date()));
  // Only the latest request may update the card, so a slow earlier reply can't overwrite it.
  const latestRequest = useRef(0);

  const fetchUpcoming = useCallback(() => {
    const request = ++latestRequest.current;
    setToday(toIsoDate(new Date()));
    listSectionAssessments(schoolId, classSectionId)
      .then((rows) => {
        if (request !== latestRequest.current) return;
        setList(rows);
        setError(null);
      })
      .catch((e) => {
        if (request === latestRequest.current) setError(getErrorMessage(e));
      });
  }, [schoolId, classSectionId]);

  useFocusEffect(
    useCallback(() => {
      fetchUpcoming();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') fetchUpcoming();
      });
      return () => subscription.remove();
    }, [fetchUpcoming])
  );

  const retry = () => {
    setError(null);
    fetchUpcoming();
  };

  const card = upcomingCardState(list, error, today);

  return (
    <>
      <Text style={styles.sectionTitle}>{t('childDashboard.upcoming.title')}</Text>
      <View style={styles.card}>
        {card.kind === 'loading' ? (
          <ActivityIndicator color={colors.primary} style={styles.cardLoading} />
        ) : card.kind === 'error' ? (
          <View>
            <ErrorNotice message={card.message} />
            <Pressable onPress={retry} style={styles.retry} accessibilityRole="button">
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : card.kind === 'empty' ? (
          <Text style={styles.cardEmpty}>{t('childDashboard.upcoming.empty')}</Text>
        ) : (
          <>
            {card.items.map((item, index) => (
              <View key={item.id} style={[styles.assessmentRow, index === 0 && styles.assessmentRowFirst]}>
                <View style={styles.assessmentIcon}>
                  <FontAwesome5 name="pen" size={14} color={colors.primary} />
                </View>
                <View style={styles.assessmentText}>
                  <Text style={styles.assessmentTitle}>{item.title}</Text>
                  <Text style={styles.assessmentMeta}>
                    {[item.subjectName, t(`childDashboard.upcoming.types.${item.type}`, { defaultValue: item.type }), item.assessmentDate]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
            ))}
            {card.moreCount > 0 && (
              <Text style={styles.more}>{t('childDashboard.upcoming.more', { count: card.moreCount })}</Text>
            )}
          </>
        )}
      </View>
    </>
  );
}

/** A parent's home for one child: today, fees due, the child's screens, what is coming up. */
export function ChildDashboardScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const { logout } = useAuth();
  const schoolId = useSchoolId();
  const student = route.params.student;
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [children, setChildren] = useState<Student[]>([]);
  // null while loading, undefined when it could not be loaded.
  const [todayStatus, setTodayStatus] = useState<string | null | undefined>(null);
  const [fees, setFees] = useState<{ due: number; earliestDueDate: string | null } | null | undefined>(null);

  useEffect(() => {
    getSchool(schoolId)
      .then((school) => setSchoolName(school.name))
      .catch(() => setSchoolName(null));
    getMyChildren(schoolId)
      .then(setChildren)
      .catch(() => setChildren([]));
  }, [schoolId]);

  // Today's status and the dues follow the child shown, and refresh on every return (a payment
  // made on the fees screen, attendance marked during the day).
  useFocusEffect(
    useCallback(() => {
      const today = todayIso();
      setTodayStatus(null);
      setFees(null);
      getStudentAttendanceHistory(schoolId, student.id, today, today)
        .then((history) => setTodayStatus(statusOn(history, today)))
        .catch(() => setTodayStatus(undefined));
      listStudentFeeAssessments(schoolId, student.id)
        .then((bills) => setFees(feeDueSummary(bills)))
        .catch(() => setFees(undefined));
    }, [schoolId, student.id])
  );

  const statusLabel =
    todayStatus === null ? null : todayStatus === undefined ? undefined : todayStatus ? t(`childDashboard.today.status.${todayStatus}`) : t('childDashboard.today.notMarked');
  const statusTone =
    todayStatus === 'PRESENT' ? colors.success : todayStatus === 'ABSENT' ? colors.error : todayStatus === 'LATE' || todayStatus === 'HALF_DAY' ? colors.warning : undefined;

  // The route carries only id/name/section; class label and roll come from the children list.
  const me = children.find((child) => child.id === student.id);

  const heroStats: HeroStat[] = [
    { label: t('childDashboard.today.attendance'), value: statusLabel, tone: statusTone },
    {
      label: t('childDashboard.today.feesDue'),
      value: fees === null ? null : fees === undefined ? undefined : compactInr(fees.due),
      tone: fees && fees.due > 0 ? colors.warning : undefined,
      pill: fees?.earliestDueDate && fees.due > 0 ? t('childDashboard.today.by', { date: formatIsoDate(fees.earliestDueDate, i18n.language) }) : undefined,
      hint: fees && fees.due === 0 ? t('childDashboard.today.allPaid') : undefined,
    },
    { label: t('childDashboard.today.class'), value: me?.classSectionLabel ?? '—', hint: me?.rollNumber ? t('childDashboard.today.roll', { roll: me.rollNumber }) : undefined },
  ];

  const tiles: { key: string; title: string; icon: string; onPress: () => void }[] = [
    { key: 'attendance', title: t('childDashboard.attendance'), icon: 'calendar-check', onPress: () => navigation.navigate('AttendanceHistory', { student }) },
    { key: 'fees', title: t('childDashboard.fees'), icon: 'rupee-sign', onPress: () => navigation.navigate('ChildFees', { student }) },
    { key: 'timetable', title: t('childDashboard.timetable'), icon: 'clock', onPress: () => navigation.navigate('MyTimetable', { student }) },
    { key: 'reportCard', title: t('childDashboard.reportCard'), icon: 'file-alt', onPress: () => navigation.navigate('ReportCard', { student }) },
    { key: 'schoolBus', title: t('childDashboard.schoolBus'), icon: 'bus', onPress: () => navigation.navigate('MyBus') },
    { key: 'idCard', title: t('childDashboard.idCard'), icon: 'id-badge', onPress: () => navigation.navigate('IdCard', { kind: 'STUDENT', id: student.id, name: student.name }) },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={student.name}
        subtitle={schoolName ?? t('dashboard.fallbackTitle')}
        onBack={children.length > 1 ? () => navigation.navigate('ParentHome') : undefined}
        showBadge={false}
      >
        <Text style={styles.headerDate}>{longDate(new Date(), language)}</Text>
        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
            {children.map((child) => {
              const active = child.id === student.id;
              return (
                <Pressable
                  key={child.id}
                  style={[styles.childChip, active && styles.childChipActive]}
                  onPress={() => !active && navigation.setParams({ student: child })}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.childInitial, active && styles.childInitialActive]}>
                    <Text style={[styles.childInitialText, active && styles.childInitialTextActive]}>{child.name.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.childChipText, active && styles.childChipTextActive]} numberOfLines={1}>
                    {child.name}
                    {child.classSectionLabel ? ` · ${child.classSectionLabel}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </ScreenHeader>
      <ScreenContainer>
        <HeroCard stats={heroStats} tint="mint" />
        <View style={styles.commsWrap}>
          <ParentCommsTiles />
        </View>
        <View style={styles.tileGrid}>
          {tiles.map((tile, index) => (
            <Pressable key={tile.key} style={[styles.tile, { backgroundColor: tints[tintAt(index)].bg }]} onPress={tile.onPress} accessibilityRole="button">
              <View style={styles.iconCircle}>
                <FontAwesome5 name={tile.icon} size={18} color={tints[tintAt(index)].fg} />
              </View>
              <Text style={styles.tileTitle}>{tile.title}</Text>
            </Pressable>
          ))}
        </View>

        {!!student.classSectionId && (
          <UpcomingAssessmentsCard key={student.classSectionId} classSectionId={student.classSectionId} />
        )}

        <Pressable style={styles.logoutButton} onPress={logout} accessibilityRole="button">
          <Text style={styles.logoutText}>{t('common.logOut')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerDate: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  switcher: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  childChipActive: { backgroundColor: colors.primary },
  childInitial: { width: 26, height: 26, borderRadius: 13, backgroundColor: tints.violet.bg, alignItems: 'center', justifyContent: 'center' },
  childInitialActive: { backgroundColor: colors.white },
  childInitialText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primary },
  childInitialTextActive: { color: colors.primary },
  childChipText: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary, maxWidth: 180 },
  childChipTextActive: { fontFamily: fonts.bodySemibold, color: colors.white },
  commsWrap: { marginTop: spacing.lg },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tileTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 24, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
  cardLoading: { marginVertical: spacing.md },
  cardEmpty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15 },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 14 },
  assessmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  assessmentRowFirst: { paddingTop: 0, marginTop: 0, borderTopWidth: 0 },
  assessmentIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  assessmentText: { flex: 1 },
  assessmentTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.textPrimary },
  assessmentMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  more: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.primary, marginTop: spacing.md },
  logoutButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  logoutText: { color: colors.error, fontFamily: fonts.headingMedium, fontSize: 14 },
});
