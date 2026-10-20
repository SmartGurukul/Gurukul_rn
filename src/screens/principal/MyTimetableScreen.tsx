import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getDayTimetable,
  getMyTimetable,
  getSectionTimetable,
  getTeacherTimetable,
  type DayOfWeek,
  type Timetable,
  type TimetableSlot,
} from '../../api/timetable';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { TimetableDateBar } from '../../components/TimetableDateBar';
import { TimetableDayTabs } from '../../components/TimetableDayTabs';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing, tintAt, tints } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  addDaysIso,
  currentPeriodNumber,
  dateViewSlots,
  defaultDay,
  formatIsoDate,
  isIsoDate,
  slotBadge,
  slotsByPeriodForDate,
  slotsForDay,
  todayIso,
  type SlotBadge,
} from '../../utils/timetable';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'MyTimetable'>;

const BADGE_VARIANT: Record<SlotBadge['kind'], 'error' | 'success' | 'warning' | 'info'> = {
  cancelled: 'error',
  extra: 'success',
  takenBy: 'warning',
  covering: 'info',
  substitute: 'warning',
};

/**
 * Read-only timetable: one date (Today by default, with that day's substitutions, cancellations
 * and extra classes) or the regular week. Four sources, picked from the route params:
 * - `classSection`: that section's timetable (a class/subject teacher, or a student, opening a class)
 * - `student`: a parent viewing one child's section
 * - `teacher`: an admin viewing any teacher's periods
 * - none: the caller's own timetable (a teacher's periods across sections, or a student's class)
 * `date` opens on that date - a timetable-change push passes it.
 */
export function MyTimetableScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const classSection = route.params?.classSection;
  const student = route.params?.student;
  const teacher = route.params?.teacher;
  const paramDate = route.params?.date;
  const [selectedDate, setSelectedDate] = useState<string | null>(isIsoDate(paramDate) ? paramDate : todayIso());
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [day, setDay] = useState<DayOfWeek>('MONDAY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  // A timetable-change push tapped while this screen is open brings a new date.
  const [shownParamDate, setShownParamDate] = useState(paramDate);
  if (paramDate !== shownParamDate) {
    setShownParamDate(paramDate);
    if (isIsoDate(paramDate)) setSelectedDate(paramDate);
  }

  const load = useCallback(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const date = selectedDate;
    let request: Promise<Timetable>;
    if (date) {
      request = classSection
        ? getDayTimetable(schoolId, date, { sectionId: classSection.id })
        : teacher
          ? getTeacherTimetable(schoolId, teacher.id, date)
          : getMyTimetable(schoolId, student?.id, date);
    } else {
      request = classSection
        ? getSectionTimetable(schoolId, classSection.id)
        : teacher
          ? getTeacherTimetable(schoolId, teacher.id)
          : getMyTimetable(schoolId, student?.id);
    }
    request
      .then((tt) => {
        if (requestId !== requestRef.current) return;
        setTimetable(tt);
        if (!date) setDay(defaultDay(tt.days));
      })
      .catch((e) => {
        if (requestId === requestRef.current) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [schoolId, classSection, teacher, student?.id, selectedDate]);

  useEffect(load, [load]);

  const title = teacher
    ? teacher.name
    : classSection
      ? t('timetable.my.sectionTitle')
      : student
        ? student.name
        : t('timetable.my.title');
  const subtitle = classSection
    ? `${classSection.className} - ${classSection.section}`
    : (timetable?.sectionLabel ?? timetable?.academicYear ?? undefined);

  // Whose eyes the badges speak to: the teacher being viewed, else the signed-in staff member.
  const viewerId = teacher ? teacher.id : session.ownerType === 'EMPLOYEE' ? session.ownerId : null;
  const thirdPerson = !!teacher && !(session.ownerType === 'EMPLOYEE' && session.ownerId === teacher.id);

  const isTeacherView = timetable?.scope === 'TEACHER';
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const ready = !loading && !error && !!timetable;
  const noSchool = ready && !!selectedDate && timetable.schoolDay === false;
  const dateSlots = timetable && selectedDate ? dateViewSlots(timetable, selectedDate) : [];
  const dateByPeriod = slotsByPeriodForDate(dateSlots, viewerId);
  const weekSlots = timetable && !selectedDate ? slotsForDay(timetable.slots, day) : new Map<number, TimetableSlot>();

  const badgeText = (badge: SlotBadge) =>
    badge.kind === 'cancelled' || badge.kind === 'extra'
      ? t(`timetable.badge.${badge.kind}`)
      : t(`timetable.badge.${badge.kind}`, { teacher: badge.teacher });

  const nowPeriod = selectedDate === today && timetable ? currentPeriodNumber(timetable.periods) : null;
  const dateChanges = dateSlots.filter((slot) => !!slot.overrideKind).length;
  const dateTaught = [...dateByPeriod.values()].filter((slots) => slots.length > 0).length;

  const renderSlot = (slot: TimetableSlot, index: number) => {
    const badge = slotBadge(slot, viewerId, { thirdPerson });
    const cancelled = slot.overrideKind === 'CANCELLED';
    return (
      <View key={`${slot.sectionId}-${slot.overrideId ?? 'regular'}`} style={index > 0 ? styles.slotDivider : undefined}>
        <View style={styles.slotTop}>
          <Text style={[styles.subject, cancelled && styles.struck]} numberOfLines={1}>
            {slot.subjectName}
          </Text>
          {badge && <StatusChip label={badgeText(badge)} variant={BADGE_VARIANT[badge.kind]} />}
        </View>
        <Text style={[styles.detail, cancelled && styles.struck]} numberOfLines={1}>
          {isTeacherView ? `${slot.className} - ${slot.section}` : slot.teacherName}
          {!!slot.roomName && !cancelled ? ` · ${slot.roomName}` : ''}
        </Text>
      </View>
    );
  };

  /** One row of the day: the time on a rail, then a card (or a dashed break line, or "Free"). */
  const periodRow = (period: Timetable['periods'][number], body: ReactNode | null, isNow: boolean, tintIndex: number) => (
    <View key={period.periodNumber} style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={[styles.time, period.breakPeriod && styles.timeMuted]}>{period.startTime}</Text>
        {!period.breakPeriod && <Text style={styles.timeEnd}>{period.endTime}</Text>}
      </View>
      {period.breakPeriod ? (
        <View style={styles.breakLine}>
          <Text style={styles.breakText}>{period.label ?? t('timetable.break')}</Text>
        </View>
      ) : (
        <View style={[styles.card, body ? { backgroundColor: tints[tintAt(tintIndex)].bg } : null, isNow && styles.cardNow]}>
          {isNow && <Text style={styles.now}>{t('timetable.now')}</Text>}
          {body ?? <Text style={styles.free}>{t('timetable.free')}</Text>}
          <Text style={styles.periodNo}>{period.label ?? t('timetable.periodN', { n: period.periodNumber })}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={subtitle} onBack={() => navigation.goBack()}>
        <TimetableDateBar value={selectedDate} onChange={setSelectedDate} showWeek onViolet />
        {ready && !selectedDate && timetable.periods.length > 0 && (
          <TimetableDayTabs days={timetable.days} selected={day} onSelect={setDay} onViolet />
        )}
      </ScreenHeader>
      <ScreenContainer>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {error && (
          <View>
            <ErrorNotice message={t('timetable.loadFailed', { message: error })} />
            <Pressable onPress={load} style={styles.retry}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {ready && timetable.periods.length === 0 && <Text style={styles.empty}>{t('timetable.noPeriods')}</Text>}

        {noSchool && selectedDate && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              {t('timetable.date.noSchool', { date: formatIsoDate(selectedDate, i18n.language) })}
            </Text>
            {!!timetable?.holidayName && (
              <Text style={styles.noticeText}>{t('timetable.date.holiday', { name: timetable.holidayName })}</Text>
            )}
            <View style={styles.noticeButtons}>
              {selectedDate !== tomorrow && (
                <Pressable style={styles.noticeButton} onPress={() => setSelectedDate(tomorrow)}>
                  <Text style={styles.noticeButtonText}>{t('timetable.date.tomorrow')}</Text>
                </Pressable>
              )}
              <Pressable style={styles.noticeButton} onPress={() => setSelectedDate(null)}>
                <Text style={styles.noticeButtonText}>{t('timetable.date.week')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {ready && !noSchool && selectedDate && timetable.periods.length > 0 && (
          <>
            <Text style={styles.summary}>
              {dateSlots.length === 0
                ? t('timetable.my.nothingToday')
                : dateChanges > 0
                  ? t('timetable.my.summaryWithChanges', { periods: dateTaught, changes: dateChanges })
                  : t('timetable.my.summary', { periods: dateTaught })}
            </Text>
            {timetable.periods.map((period, index) => {
              const slots = dateByPeriod.get(period.periodNumber) ?? [];
              return periodRow(period, slots.length > 0 ? slots.map(renderSlot) : null, nowPeriod === period.periodNumber, index);
            })}
          </>
        )}

        {ready && !selectedDate && timetable.periods.length > 0 && (
          <>
            {timetable.slots.length === 0 && (
              <Text style={styles.empty}>
                {isTeacherView ? t('timetable.my.emptyTeacher') : t('timetable.my.emptySection')}
              </Text>
            )}
            {timetable.periods.map((period, index) => {
              const slot = weekSlots.get(period.periodNumber);
              return periodRow(
                period,
                slot ? (
                  <>
                    <Text style={styles.subject} numberOfLines={1}>
                      {slot.subjectName}
                    </Text>
                    <Text style={styles.detail} numberOfLines={1}>
                      {isTeacherView ? `${slot.className} - ${slot.section}` : slot.teacherName}
                      {slot.roomName ? ` · ${slot.roomName}` : ''}
                    </Text>
                  </>
                ) : null,
                false,
                index
              );
            })}
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  retryText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 14 },
  empty: { color: colors.textMuted, marginBottom: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  summary: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  noticeTitle: { color: colors.textPrimary, fontFamily: fonts.headingMedium, fontSize: 15, lineHeight: 20 },
  noticeText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.xs },
  noticeButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  noticeButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  noticeButtonText: { color: colors.primary, fontFamily: fonts.headingMedium, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'stretch', marginBottom: spacing.sm },
  timeCol: { width: 52, paddingTop: spacing.md, alignItems: 'flex-end', paddingRight: spacing.md },
  time: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  timeMuted: { color: colors.textMuted, fontFamily: fonts.body },
  timeEnd: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.textMuted },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cardNow: { borderColor: colors.primary, borderWidth: 2 },
  now: { position: 'absolute', top: spacing.sm, right: spacing.md, fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.primary },
  breakLine: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  breakText: { position: 'absolute', left: spacing.md, top: -9, backgroundColor: colors.background, paddingHorizontal: 6, fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  slotDivider: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.7)' },
  slotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  subject: { fontFamily: fonts.headingMedium, fontSize: 15, lineHeight: 20, color: colors.textPrimary, flexShrink: 1 },
  detail: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  free: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  periodNo: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.textMuted, marginTop: spacing.xs },
});
